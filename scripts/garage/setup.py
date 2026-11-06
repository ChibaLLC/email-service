#!/usr/bin/env python3
"""Configure and initialize the bundled, single-node Garage deployment."""
import json
import os
from pathlib import Path
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def env(name, default):
    return os.environ.get(name) or default


def render():
    directory = Path(env("GARAGE_CONFIG_DIR", "/etc/garage"))
    directory.mkdir(parents=True, exist_ok=True)
    # Keep these across container recreation. Never log either secret.
    for name in ("rpc-secret", "admin-token"):
        path = directory / name
        if not path.exists():
            path.write_text(secrets.token_hex(32))
        path.chmod(0o600)
    quoted = json.dumps
    config = f'''metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"
replication_factor = 1
rpc_bind_addr = "[::]:3901"
rpc_public_addr = "stalwart-garage:3901"
rpc_secret = {quoted((directory / "rpc-secret").read_text().strip())}

[s3_api]
s3_region = {quoted(env("STALWART_S3_REGION", "garage"))}
api_bind_addr = "[::]:3900"

[admin]
api_bind_addr = "[::]:3903"
admin_token = {quoted((directory / "admin-token").read_text().strip())}
metrics_token = {quoted((directory / "admin-token").read_text().strip())}
'''
    path = directory / "garage.toml"
    path.write_text(config)
    path.chmod(0o600)
    print("Garage configuration ready")


def initialize():
    token = Path(env("GARAGE_CONFIG_DIR", "/etc/garage"), "admin-token").read_text().strip()
    base = env("GARAGE_ADMIN_URL", "http://stalwart-garage:3903").rstrip("/")

    def api(operation, body=None, **query):
        url = base + "/v2/" + operation
        if query:
            url += "?" + urllib.parse.urlencode(query)
        request = urllib.request.Request(
            url, data=None if body is None else json.dumps(body).encode(),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.load(response)

    for attempt in range(60):
        try:
            status = api("GetClusterStatus")
            break
        except urllib.error.HTTPError:
            raise  # Invalid credentials/configuration must not be hidden by retries.
        except (urllib.error.URLError, TimeoutError):
            if attempt == 59:
                raise
            time.sleep(2)

    layout = api("GetClusterLayout")
    if not layout["roles"]:
        nodes = [node for node in status["nodes"] if node["isUp"]]
        if len(nodes) != 1:
            raise RuntimeError("Automatic initialization requires exactly one Garage node")
        node_id = nodes[0]["id"]
        # Resume our staged first layout after interruption, but never adopt
        # staged changes belonging to another cluster deployment.
        if any(role["id"] != node_id for role in layout["stagedRoleChanges"]):
            raise RuntimeError("Unexpected staged Garage layout; inspect it manually")
        capacity = int(env("GARAGE_CAPACITY_BYTES", "10000000000"))
        if capacity <= 0:
            raise ValueError("GARAGE_CAPACITY_BYTES must be positive")
        api("UpdateClusterLayout", {"roles": [{
            "id": node_id, "zone": "local", "capacity": capacity, "tags": ["stalwart"],
        }]})
        api("ApplyClusterLayout", {"version": layout["version"] + 1})

    bucket_name = env("STALWART_S3_BUCKET", "stalwart")
    buckets = [b for b in api("ListBuckets") if bucket_name in b["globalAliases"]]
    bucket = buckets[0] if buckets else api("CreateBucket", {"globalAlias": bucket_name})
    key_name = "stalwart-" + bucket_name
    keys = [key for key in api("ListKeys") if key["name"] == key_name]
    if len(keys) > 1:
        raise RuntimeError("Duplicate Garage key names; inspect before continuing")
    if keys:
        key = api("GetKeyInfo", id=keys[0]["id"], showSecretKey="true")
    else:
        key = api("CreateKey", {"name": key_name})
    if key.get("expired") or not key.get("secretAccessKey"):
        raise RuntimeError("Garage key is expired or its secret is unavailable")
    api("AllowBucketKey", {
        "bucketId": bucket["id"], "accessKeyId": key["accessKeyId"],
        "permissions": {"read": True, "write": True, "owner": False},
    })
    directory = Path(env("GARAGE_CREDENTIALS_DIR", "/etc/stalwart-s3"))
    directory.mkdir(parents=True, exist_ok=True)
    uid = int(env("STALWART_UID", "2000"))
    os.chown(directory, uid, uid)
    directory.chmod(0o750)
    for name, value in (("access-key", key["accessKeyId"]), ("secret-key", key["secretAccessKey"])):
        temporary = directory / (name + ".tmp")
        temporary.write_text(value)
        os.chown(temporary, uid, uid)
        temporary.chmod(0o400)
        temporary.replace(directory / name)
    print("Garage bucket and Stalwart credentials ready")


if __name__ == "__main__":
    if sys.argv[1:] == ["render"]:
        render()
    elif sys.argv[1:] == ["initialize"]:
        initialize()
    else:
        raise SystemExit("Usage: setup.py render|initialize")
