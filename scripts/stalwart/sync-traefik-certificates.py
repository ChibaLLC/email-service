#!/usr/bin/env python3
"""Copy renewed Traefik certificates into Stalwart for direct SMTP/IMAP TLS."""
import argparse
import base64
import json
import subprocess
import urllib.request

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hostname", action="append", required=True, help="Repeat for aliases; first is the default certificate")
    parser.add_argument("--traefik-container", default="dokploy-traefik")
    parser.add_argument("--acme-path", default="/etc/dokploy/traefik/dynamic/acme.json")
    parser.add_argument("--stalwart-container", default="email-service-stalwart-1")
    parser.add_argument("--api-url", default="http://127.0.0.1:8080")
    parser.add_argument("--restart-on-change", action="store_true", help="Restart Stalwart after certificate changes so direct mail listeners reload TLS")
    args = parser.parse_args()
    info = json.loads(subprocess.check_output(["docker", "inspect", args.stalwart_container]))[0]
    env = dict(value.split("=", 1) for value in info["Config"]["Env"])
    auth = "Basic " + base64.b64encode(env["STALWART_RECOVERY_ADMIN"].encode()).decode()

    def call(method, arguments):
        request = urllib.request.Request(
            args.api_url.rstrip("/") + "/jmap/",
            data=json.dumps({"using": ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
                             "methodCalls": [[method, arguments, "cert-sync"]]}).encode(),
            headers={"Authorization": auth, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            name, result, _ = json.load(response)["methodResponses"][0]
        if name != method or result.get("notCreated") or result.get("notUpdated"):
            raise RuntimeError(method + " failed; inspect the Stalwart server logs")
        return result

    acme = json.loads(subprocess.check_output(
        ["docker", "exec", args.traefik_container, "cat", args.acme_path]))
    available = [cert for resolver in acme.values() if isinstance(resolver, dict)
                 for cert in resolver.get("Certificates", [])]
    selected = []
    for hostname in args.hostname:
        matches = [cert for cert in available if hostname in
                   [cert["domain"]["main"], *cert["domain"].get("sans", [])]]
        if not matches:
            raise RuntimeError("Traefik has not issued a certificate for " + hostname)
        selected.append((hostname, matches[-1]))
    existing = call("x:Certificate/get", {})["list"]
    changed = False
    default_id = None
    for hostname, cert in selected:
        pem = base64.b64decode(cert["certificate"]).decode()
        current = next((item for item in existing if hostname in item.get("subjectAlternativeNames", {})), None)
        if current and current.get("certificate", {}).get("value") == pem:
            certificate_id = current["id"]
        else:
            value = {"certificate": {"@type": "Text", "value": pem},
                     "privateKey": {"@type": "Text", "secret": base64.b64decode(cert["key"]).decode()}}
            if current:
                call("x:Certificate/set", {"update": {current["id"]: value}})
                certificate_id = current["id"]
            else:
                certificate_id = call("x:Certificate/set", {"create": {"sync": value}})["created"]["sync"]["id"]
            existing = call("x:Certificate/get", {})["list"]
            changed = True
        if default_id is None:
            default_id = certificate_id
        print("Certificate available in Stalwart:", hostname)
    current_default = call("x:SystemSettings/get", {"ids": ["singleton"]})["list"][0].get("defaultCertificateId")
    if current_default != default_id:
        call("x:SystemSettings/set", {"update": {"singleton": {"defaultCertificateId": default_id}}})
        changed = True
    if changed:
        call("x:Action/set", {"create": {"reload": {"@type": "ReloadSettings"}}})
        print("Stalwart TLS settings reloaded")
        if args.restart_on_change:
            subprocess.run(["docker", "restart", args.stalwart_container], check=True, stdout=subprocess.DEVNULL)
            print("Stalwart restarted to reload mail listener certificates")
        else:
            print("Restart Stalwart if mail listeners still present the previous certificate")
    else:
        print("Certificates already current")

if __name__ == "__main__":
    main()
