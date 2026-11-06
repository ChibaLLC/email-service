# Stalwart, Garage and Bulwark

The Stalwart-only stack uses PostgreSQL for metadata, Redis, Garage for S3 blobs,
and Bulwark for webmail. `docker-compose.prod.yml` includes the same services plus
the email app, Postal, Listmonk and Libredesk.

## Configure a new installation

Copy `.env.example` to `.env`, replace example passwords and set:

```dotenv
STALWART_HOSTNAME=mail.example.com
STALWART_PUBLIC_URL=https://mail.example.com
STALWART_DEFAULT_DOMAIN=example.com
BULWARK_WEBMAIL_HOSTNAME=webmail.example.com
BULWARK_JMAP_SERVER_URL=https://mail.example.com
STALWART_HTTP_CORS_ALLOWED_ORIGINS=https://webmail.example.com
BULWARK_OAUTH_ENABLED=false
```

Generate `BULWARK_SESSION_SECRET` with `openssl rand -base64 32`.
`STALWART_HOSTNAME` is the public mail server name, while
`STALWART_DEFAULT_DOMAIN` is the mailbox domain. They may belong to different
parent domains. Compose assigns the public hostname to the container so Docker's
container ID is never used as the initial server name.

Start the mail services:

```sh
docker compose -f docker-compose.stalwart.yml up -d
```

Garage initialization creates a single-node layout, a bucket, and a generated
bucket-scoped S3 key. It reuses them on subsequent runs. Its config, metadata,
objects and Stalwart credentials have separate persistent volumes. No Garage
ports are published on the host. The S3 endpoint is `http://stalwart-garage:3900`,
region `garage`, bucket `stalwart`, unless the corresponding variables are changed.
When `GARAGE_CAPACITY_BYTES` is empty, initialization probes free space on the
Garage data volume and reserves the larger of 20% of that space or 5 GiB. The
remaining capacity is rounded down to whole GiB; less than 1 GiB fails explicitly.
Set a positive byte count to override this calculation. Existing layouts are
never resized automatically.
This single-node installation has no storage redundancy: back up the database,
Garage metadata/data/config and credential volumes together.

The generator writes `/etc/stalwart/datastore.json`, `bootstrap.json` and
`apply-plan.ndjson`. **Writing these files alone does not configure a running
Stalwart database.** It leaves the live `config.json` untouched. A fresh server
enters bootstrap because that file does not exist; the bootstrap API writes it
after initializing the chosen datastore. On a new, empty store, initialize explicitly:

```sh
docker compose -f docker-compose.stalwart.yml run --rm --no-deps stalwart-config node /scripts/bootstrap.mjs --new-install
docker compose -f docker-compose.stalwart.yml restart stalwart
docker compose -f docker-compose.stalwart.yml run --rm --no-deps stalwart-config node /scripts/apply.mjs
```

The bootstrap request selects PostgreSQL, Garage and Redis using the generated
credentials. Stalwart refuses it if the datastore is already initialized. Do not
use bootstrap to migrate an existing installation. Alternatively, complete the
setup wizard directly through the loopback HTTP listener/SSH tunnel and select
these stores there, then run the settings apply command.

The admin credential comes from `STALWART_ADMIN_USER` and
`STALWART_ADMIN_PASSWORD` through `STALWART_RECOVERY_ADMIN`; this credential works
without enabling recovery mode. After creating a normal administrator, manage
that fallback credential according to your access policy.

## HTTPS with Traefik / Dokploy

With an existing Traefik container on `dokploy-network`, set:

```dotenv
BULWARK_TRAEFIK_DOCKER_NETWORK=dokploy-network
BULWARK_TRAEFIK_HTTPS_ENTRYPOINT=websecure
BULWARK_TRAEFIK_CERTRESOLVER=letsencrypt
```

Run Compose 2.24.4 or newer:

```sh
docker compose -f docker-compose.stalwart.yml -f docker-compose.webmail-traefik.yml up -d
```

Include the same overlay in subsequent `run`, `restart` and `up` commands. It
attaches both services to the external proxy network and replaces the legacy
TCP passthrough labels. Traefik terminates HTTPS, forwarding Stalwart to port
8080 and Bulwark to port 3000. The network, entrypoint and certificate resolver
must already exist. For HTTP-01 issuance, ports 80/443 must reach Traefik.

Point the mail and webmail DNS records at the server. Use DNS-only records for
hostnames that also serve SMTP/IMAP. Open `https://mail.example.com/admin` and
`https://webmail.example.com`. Normal Stalwart WebUI sign-in requires its public
HTTPS hostname; an SSH tunnel to HTTP 8080 only suffices during initial bootstrap
or recovery. Recovery mode stops mail services and is not an ordinary login fix.

The overlay publishes Stalwart HTTP only on `127.0.0.1:8080`. Bulwark also has a
loopback diagnostic endpoint on `127.0.0.1:8081` (`BULWARK_LOCAL_PORT`). Bulwark's
JMAP URL must resolve and have trusted TLS from both browsers and its container;
`http://stalwart:8080` is not a browser-reachable URL.

Mail protocol ports remain published directly by Stalwart and need certificates
configured in Stalwart itself. Traefik's HTTPS certificate does not configure
SMTP or IMAP TLS. Configure Stalwart's DNS provider and ACME provider through its
WebUI; legacy `STALWART_ACME_DNS_*` environment variables are not automatically
applied to database-backed provider settings by this generator. A Cloudflare
API token needs Zone Read and DNS Edit for the managed zone; do not supply a
legacy global-key email field with an API token.

## Apply hostname and CORS changes

After changing `.env`, run:

```sh
docker compose -f docker-compose.stalwart.yml run --rm --no-deps stalwart-config node /scripts/apply.mjs
```

This updates `SystemSettings.defaultHostname`, its existing default-domain ID,
the SMTP hostname, and HTTP settings, then runs `ReloadSettings`. It preserves
existing unrelated response headers and never replaces listeners, domains, DKIM
keys, certificates or blob stores. An unknown/ambiguous default domain fails
explicitly; set `STALWART_DEFAULT_DOMAIN` to an existing domain.

`STALWART_HTTP_CORS_ALLOWED_ORIGINS` accepts **one** explicit webmail origin,
including scheme and any nonstandard port. Multiple origins and `*` are rejected
instead of silently taking the first. `STALWART_HTTP_PERMISSIVE_CORS=true` is the
separate opt-in for permissive CORS. A static origin takes precedence if supplied.
Check preflight and real responses, not just the backend's health endpoint:

```sh
curl -i -X OPTIONS https://mail.example.com/jmap/session \
  -H 'Origin: https://webmail.example.com' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

The response must allow the webmail origin and Authorization header.
`STALWART_HTTP_USE_X_FORWARDED=true` maps to Stalwart 1.0's `clientIpSource` field.
Enable it only when every HTTP listener is restricted to trusted proxies.

If the proxy receives connection resets/502 while local HTTP works, inspect
Stalwart's Blocked IPs. Set `STALWART_ALLOWED_IP` to the proxy's exact address and
run the apply helper; its AllowedIp entry exempts that proxy from auto-ban after
settings reload. Recheck the address if the proxy is recreated. Do not allow an
entire public network or disable auto-ban globally.

## Existing MinIO installations: migrate before switching stores

The default stack now uses Garage. It does **not** copy old blobs or overwrite
Stalwart's existing BlobStore settings. Keep the old store available during the
migration using `docker-compose.minio-legacy.yml` and your existing
`STALWART_MINIO_ROOT_USER` / `STALWART_MINIO_ROOT_PASSWORD`:

```sh
docker compose -f docker-compose.stalwart.yml -f docker-compose.minio-legacy.yml up -d
```

1. Back up PostgreSQL and all existing object-storage volumes. Stop mail writes
   during the final copy and switch; do not run `down -v`.
2. Configure an S3 copy tool such as rclone with the old MinIO endpoint and the
   Garage endpoint/region. Garage credentials are in the
   `stalwart_s3_credentials` volume (`access-key`, `secret-key`); keep them private.
3. Copy the complete old bucket into Garage, preserving every object key and
   prefix (including `stalwart/`). Use `rclone copy`, then
   `rclone check --download --one-way` while writes remain stopped. Do not use
   a destructive synchronization or delete the old bucket.
4. In Stalwart's existing S3 BlobStore, change the endpoint, region, bucket and
   access key to Garage. Use the secret form
   `{"@type":"File","filePath":"/etc/stalwart-s3/secret-key"}`.
   Keep its existing key prefix. Restart Stalwart, test old messages/attachments
   and new delivery, then resume writes.
5. Remove the migration overlay and stop the old MinIO container only after
   verification. Retain the old volume/backup for rollback.

Stalwart reads the secret as UID 2000 by default. `STALWART_UID` controls credential
file ownership if you use a custom image. Changing Compose environment alone
never changes an existing database-backed BlobStore.

## Replacing Twake

Both Stalwart-only and production stacks now start Bulwark. Settings persist in
`bulwark_data:/app/data`. Start and verify Bulwark, then stop the old container
using its actual Compose project name:

```sh
docker compose -f docker-compose.stalwart.yml -f docker-compose.webmail-traefik.yml up -d --no-deps bulwark-web
docker stop <project>-tmail-web-1
```

Password login is the default. Enable OAuth only after registering the client
and redirect URLs. Do not use `down -v` or remove mail/database volumes.

## Validation

```sh
node --test tests/stalwart/config.test.mjs
docker compose --env-file .env.example -f docker-compose.stalwart.yml config --quiet
```

An optional S3 test writes, reads and deletes one random test object:

```sh
docker compose -f docker-compose.stalwart.yml run --rm --no-deps --entrypoint sh stalwart-garage-init \
  -c 'pip install -q boto3 && python /scripts/smoke-test.py'
```

## Email app, Postal and DNS

Configure the email app's SMTP provider in **Outbound email**, using a real
Stalwart mailbox and submission port 587 (STARTTLS), or 465 (implicit TLS).
Provider credentials are stored encrypted in the app database.

When Stalwart receives a domain's mail, its MX must target the public mail server
hostname, never a Docker container ID. Do not keep another inbound system's MX
unless you deliberately operate both. Publish Stalwart's DKIM records, one SPF
policy reflecting all legitimate senders, DMARC and the requested discovery
records. Set the server provider's reverse DNS/PTR to the public mail hostname.

References: [Stalwart installation](https://stalw.art/docs/install/platform/docker/),
[settings reload](https://stalw.art/docs/management/tasks-actions/actions/),
[Garage administration](https://garagehq.deuxfleurs.fr/documentation/reference-manual/admin-api/).

## Email app behind the same proxy

Set `EMAIL_APP_HOSTNAME=email.example.com`, point its DNS record at the VPS,
and include `docker-compose.app-traefik.yml` after the mail proxy overlay:

```sh
docker compose -f docker-compose.prod.yml -f docker-compose.webmail-traefik.yml -f docker-compose.app-traefik.yml up -d --build postgres redis app
```

For an existing app, restore its PostgreSQL database and preserve `JWT_SECRET`,
`SETTINGS_ENCRYPTION_KEY` and `INBOUND_CONFIG_ENCRYPTION_KEY` before starting it.
The encryption keys are required to read stored mail-provider credentials.
Review pending webhook deliveries before enabling the worker after a restore.

## Reuse Traefik certificates for SMTP and IMAP

Instead of a second ACME provider, the host can periodically copy Traefik's
issued certificates into Stalwart. Python 3 and Docker access are required.
The helper reads credentials and private keys in memory without printing them.
It uses the configured fallback administrator without enabling recovery mode.
Run after Traefik has issued the certificate:

```sh
python3 scripts/stalwart/sync-traefik-certificates.py \
  --hostname mail.example.com --restart-on-change
```

Repeat `--hostname` for legacy mail aliases that have their own Traefik-issued
certificate. The first hostname becomes Stalwart's default certificate. Override
`--traefik-container`, `--acme-path`, `--stalwart-container` and `--api-url` when
needed. Defaults target Dokploy and the loopback Stalwart HTTP listener.
Schedule this command hourly with cron or a systemd timer, using absolute paths.
An unchanged certificate does not restart anything; a renewal briefly restarts
Stalwart so direct mail listeners load the new certificate. Check the timer's
logs and verify port 993/465 TLS independently of HTTPS.
