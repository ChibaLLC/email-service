# Postal Setup

This guide covers the Postal-specific setup for this repo: starting the local Postal overlay, configuring the app to use Postal as its provider, completing the initial Postal UI setup, and adding the DNS records Postal requires for real delivery.

This repo supports two Postal usage modes:

- Local Postal for development via the compose overlay in [docker-compose.postal.yml](/home/allanbosire/Desktop/chiba/email-service/docker-compose.postal.yml)
- External Postal by pointing the app at an existing Postal instance with `POSTAL_API_URL`

## What This Repo Provides

The repo already includes:

- A Postal provider implementation in [server/email/providers/postal.ts](/home/allanbosire/Desktop/chiba/email-service/server/email/providers/postal.ts)
- Provider env validation in [server/email/config.ts](/home/allanbosire/Desktop/chiba/email-service/server/email/config.ts)
- A Postal compose overlay in [docker-compose.postal.yml](/home/allanbosire/Desktop/chiba/email-service/docker-compose.postal.yml)
- A Node-based Postal CLI in [scripts/postal.mjs](/home/allanbosire/Desktop/chiba/email-service/scripts/postal.mjs)
- Reusable Postal config helpers in [scripts/postal/config.mjs](/home/allanbosire/Desktop/chiba/email-service/scripts/postal/config.mjs) and [scripts/postal/env.mjs](/home/allanbosire/Desktop/chiba/email-service/scripts/postal/env.mjs)
- Dev scripts in [package.json](/home/allanbosire/Desktop/chiba/email-service/package.json)

## Prerequisites

Before using Postal with this repo, make sure you have:

- Docker and Docker Compose working locally
- Node and `pnpm` installed
- The base app dependencies installed with `pnpm install`
- A `.env` file copied from [.env.example](/home/allanbosire/Desktop/chiba/email-service/.env.example) if you are not letting the dev scripts create it for you

For real outbound delivery beyond local testing, you also need:

- A publicly reachable server or host for Postal
- Control over your DNS zone
- An understanding that running your own mail server includes DNS, IP reputation, and ongoing maintenance

## Quick Start

### 1. Start the stack with Postal

For a containerized deployment behind Traefik:

```bash
pnpm postal:prepare
docker compose -f docker-compose.yml -f docker-compose.postal.yml --env-file .env up -d
```

For native Nuxt development with Postal running in containers:

```bash
pnpm dev:start:postal
```

That command uses the generic dev orchestrator in [scripts/dev.mjs](/home/allanbosire/Desktop/chiba/email-service/scripts/dev.mjs) with the Postal overlay enabled.

On first run the helper will prepare local Postal config under `docker/postal/config/`, then start:

- PostgreSQL for this app
- Redis for this app
- Postal MariaDB
- Postal web
- Postal worker
- Postal SMTP

Important: because the compose files now use `expose` instead of `ports`, the native `pnpm dev:start:postal` path only works if your host can still reach the app database and Redis. For Traefik-based deployments, prefer the full Docker Compose command above.

If you want to prepare or manage Postal separately from the Nuxt dev process, these scripts are available:

- `pnpm postal:prepare`
- `pnpm postal:prepare:force`
- `pnpm postal:preview`
- `pnpm postal:up`
- `pnpm postal:down`
- `pnpm postal:reset`

Mode notes:

- `pnpm postal:preview` prints the generated `postal.yml` to stdout without writing files
- `pnpm postal:prepare:force` regenerates both `postal.yml` and the Postal signing key
- `pnpm dev:start:postal` starts the app plus the full local Postal overlay, including SMTP on `POSTAL_SMTP_PORT` which defaults to `2525`

### 2. Configure the app to use Postal

Update `.env`:

```bash
EMAIL_PROVIDER=postal
POSTAL_API_URL=http://postal-web:5000
POSTAL_SERVER_API_KEY=postal_server_api_key
DEFAULT_FROM=verified-sender@example.com
```

Notes:

- `POSTAL_API_URL` is the Postal web base URL, not the full send endpoint
- In Docker Compose, use the internal service URL such as `http://postal-web:5000`
- If the app is outside Docker, use your Traefik hostname or another reachable Postal URL instead
- `POSTAL_SERVER_API_KEY` is a Postal server API credential created inside Postal
- `DEFAULT_FROM` must be an address your Postal server is allowed to send from

The app validates these values at startup through [server/plugins/00.email-config.ts](/home/allanbosire/Desktop/chiba/email-service/server/plugins/00.email-config.ts). If they are missing or invalid, startup fails early.

### 3. Optional: configure Postal DNS values from env

If you want the generated `postal.yml` to include Postal's DNS block, set these in `.env`:

```bash
POSTAL_DNS_MX_RECORDS=mx1.postal.example.com,mx2.postal.example.com
POSTAL_DNS_SPF_INCLUDE=spf.postal.example.com
POSTAL_DNS_RETURN_PATH_DOMAIN=rp.postal.example.com
POSTAL_DNS_ROUTE_DOMAIN=routes.postal.example.com
POSTAL_DNS_TRACK_DOMAIN=track.postal.example.com
```

Validation rules:

- If you set any `POSTAL_DNS_*` value, `POSTAL_DNS_MX_RECORDS`, `POSTAL_DNS_SPF_INCLUDE`, and `POSTAL_DNS_RETURN_PATH_DOMAIN` become required
- `POSTAL_DNS_MX_RECORDS` must be a comma-separated list of valid hostnames
- All configured `POSTAL_DNS_*` values are validated by [scripts/postal.mjs](/home/allanbosire/Desktop/chiba/email-service/scripts/postal.mjs) before `postal.yml` is written

The Postal DNS values are intentionally validated in the Postal CLI rather than the app provider config because they belong to the generated Postal server configuration, not to this app's HTTP send credentials.

## Postal UI Setup

After Postal is running, open Postal at the hostname your reverse proxy exposes for it. In a pure internal Docker setup, the app should still talk to Postal at `http://postal-web:5000`.

The minimum Postal-side setup is:

1. Create your first Postal user if this is a fresh instance.
2. Create a mail server in Postal.
3. Add the sending domain you want Postal to use.
4. Generate a server API credential from Postal for that mail server.
5. Copy that key into `POSTAL_SERVER_API_KEY` in `.env`.

Without that server API key, the app cannot send through Postal even if the containers are running.

## DNS Requirements

For actual delivery outside local testing, Postal requires DNS to be set up. The official Postal documentation lists these records as the core starting point.

### Core host records

- `postal.example.com` as `A` and optionally `AAAA` for the Postal web/API and SMTP hostname

If you want dedicated MX hosts instead of reusing the main hostname:

- `mx1.postal.example.com` as `A` and optionally `AAAA`
- `mx2.postal.example.com` as `A` and optionally `AAAA`

### SPF include record

- `spf.postal.example.com` as `TXT`

Example value from the official docs:

```txt
v=spf1 ip4:YOUR_SERVER_IP ~all
```

You may choose `-all` instead of `~all` if you want a stricter SPF policy.

### Return-path domain

Postal expects a return-path domain. The official docs show a pattern like this:

- `rp.postal.example.com` as `A`
- `rp.postal.example.com` as optional `AAAA`
- `rp.postal.example.com` as `MX 10 postal.example.com`
- `rp.postal.example.com` as `TXT v=spf1 a mx include:spf.postal.example.com ~all`
- `postal._domainkey.rp.postal.example.com` as `TXT` using the DKIM value generated by Postal

### Optional but useful records

- `routes.postal.example.com` as `MX` if you want inbound route handling in Postal
- `track.postal.example.com` as `A` and optionally `AAAA` if you want click/open tracking

### Postal DNS config block

The official docs also show a corresponding Postal config block like this:

```yaml
dns:
  mx_records:
    - mx1.postal.example.com
    - mx2.postal.example.com
  spf_include: spf.postal.example.com
  return_path_domain: rp.postal.example.com
  route_domain: routes.postal.example.com
  track_domain: track.postal.example.com
```

Replace those example values with your real hostnames and domains.

If you set the matching `POSTAL_DNS_*` env vars described above, [scripts/postal.mjs](/home/allanbosire/Desktop/chiba/email-service/scripts/postal.mjs) will render this block into the generated `postal.yml` automatically.

## Important Caveats

These are the main things people usually miss when getting started with Postal:

- Running the local overlay is not enough for real email delivery; you still need DNS and a reachable Postal host
- `POSTAL_SERVER_API_KEY` is not auto-generated by this repo; you must create it in Postal
- Local development can prove provider integration, queueing, and API flow, but not real deliverability
- `DEFAULT_FROM` should match a sender/domain that Postal recognizes for the mail server you created
- The local overlay is a development convenience, not a production-grade Postal deployment

## Local Overlay Notes

The Postal CLI in [scripts/postal.mjs](/home/allanbosire/Desktop/chiba/email-service/scripts/postal.mjs) generates:

- `docker/postal/config/postal.yml`
- `docker/postal/config/signing.key`

`postal.yml` is regenerated from env values each time you run `pnpm postal:prepare`, `pnpm postal:prepare:force`, `pnpm postal:up`, `pnpm postal:reset`, or `pnpm dev:start:postal`. That is intentional so changes to `POSTAL_*` and `POSTAL_DNS_*` values are reflected without manually deleting the file first.

Those generated files are intentionally ignored by Git via [.gitignore](/home/allanbosire/Desktop/chiba/email-service/.gitignore).

The current local overlay starts Postal web, worker, and SMTP roles plus Postal MariaDB. It is designed to get this app integrated with Postal locally; it is not a full recommendation for internet-facing Postal hosting.

## Verifying The App Integration

Once your Postal server API key is in `.env`, verify the integration with this app:

1. Start the app with `pnpm dev:start:postal`.
2. Confirm the app boots without provider validation errors.
3. Use the dashboard test email flow or `POST /send`.
4. Check the Postal UI to confirm the message reached Postal.

If the app fails on startup, the first place to look is [server/email/config.ts](/home/allanbosire/Desktop/chiba/email-service/server/email/config.ts) because the provider validation is intentionally strict.

## Official Postal References

These docs were used as the basis for the DNS notes above:

- Postal getting started: `https://docs.postalserver.io/getting-started`
- Postal DNS configuration: `https://docs.postalserver.io/getting-started/dns-configuration`
- Postal API docs: `https://docs.postalserver.io/developer/api/`