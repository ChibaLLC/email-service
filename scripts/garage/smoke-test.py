#!/usr/bin/env python3
"""Optional S3 smoke test; requires boto3. Touches only one random test object."""
import os
from pathlib import Path
import uuid

import boto3
from botocore.config import Config

credentials = Path(os.environ.get("GARAGE_CREDENTIALS_DIR", "/etc/stalwart-s3"))
client = boto3.client(
    "s3", endpoint_url=os.environ.get("STALWART_S3_ENDPOINT", "http://stalwart-garage:3900"),
    region_name=os.environ.get("STALWART_S3_REGION", "garage"),
    aws_access_key_id=(credentials / "access-key").read_text().strip(),
    aws_secret_access_key=(credentials / "secret-key").read_text().strip(),
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
)
bucket = os.environ.get("STALWART_S3_BUCKET", "stalwart")
key = "setup-smoke-test/" + uuid.uuid4().hex
payload = b"Stalwart Garage S3 validation\n"
try:
    client.put_object(Bucket=bucket, Key=key, Body=payload)
    assert client.get_object(Bucket=bucket, Key=key)["Body"].read() == payload
finally:
    client.delete_object(Bucket=bucket, Key=key)
print("S3 write/read/delete passed")
