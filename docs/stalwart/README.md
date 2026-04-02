# Stalwart Setup

This guide covers the Stalwart-specific setup for this repo: running the production-oriented Stalwart stack alongside the app and using it from the app through the existing nodemailer provider.

## What This Repo Provides

- A production Stalwart compose overlay in [docker-compose.stalwart.yml](c:/Users/AllanBosire/Desktop/email-service/docker-compose.stalwart.yml)
- A Stalwart config generator in [scripts/stalwart/config.mjs](c:/Users/AllanBosire/Desktop/email-service/scripts/stalwart/config.mjs) and [scripts/stalwart/init.mjs](c:/Users/AllanBosire/Desktop/email-service/scripts/stalwart/init.mjs)
- App integration through the existing nodemailer provider in [server/email/providers/nodemailer.ts](c:/Users/AllanBosire/Desktop/email-service/server/email/providers/nodemailer.ts)

## Quick Start

### 1. Start the production-oriented Stalwart stack

```bash
docker compose -f docker-compose.yml -f docker-compose.stalwart.yml --env-file .env up -d
```

This starts the app stack plus:

- Stalwart
- dedicated PostgreSQL for Stalwart metadata and internal directory state
- dedicated Redis for lookup and in-memory state
- dedicated MinIO for blob/object storage
- one-shot init services that create the MinIO bucket and write the Stalwart `config.toml`

The production overlay publishes the standard mail ports directly on the host: `25`, `587`, `465`, `143`, `993`, `110`, `995`, `4190`, `8080`, and `443`.

If you deploy with the repo's consolidated prod file, Stalwart is also available through [docker-compose.prod.yml](c:/Users/AllanBosire/Desktop/email-service/docker-compose.prod.yml).

## First Login

Stalwart creates an initial admin account automatically on first boot. Read it from the container logs:

For containerized deployment:

```bash
docker compose -f docker-compose.yml -f docker-compose.stalwart.yml --env-file .env logs stalwart
```

The logs include a line like:

```text
Your administrator account is 'admin' with password '...'
```

Use those credentials to sign in to the Stalwart web UI.

## Configure Stalwart In Production

The production overlay writes a `config.toml` that preselects these backends from first boot:

- data store: PostgreSQL
- search store: PostgreSQL
- blob store: MinIO (S3-compatible)
- lookup/in-memory store: Redis
- directory: internal directory backed by PostgreSQL

That avoids the "boot with RocksDB first, migrate later" problem.

After first login:

1. Open the Stalwart web admin.
2. Go to `Settings` > `Server` > `Network` and set the real server hostname.
3. Go to `Management` > `Directory` > `Domains` and add your mail domain.
4. Copy the DNS records Stalwart generates and publish them at your DNS provider.
5. Go to `Management` > `Directory` > `Accounts` and create the mailboxes or SMTP accounts you need.
6. If needed, configure TLS in Stalwart or terminate TLS in your reverse proxy.
7. Create the user accounts or mailboxes you want your team to use.

Stalwart generates its own recommended DNS records per configured domain, including SPF, DKIM, DMARC, and optional autoconfig/SRV guidance.

Important production env keys in [.env.example](c:/Users/AllanBosire/Desktop/email-service/.env.example):

- `STALWART_HOSTNAME`
- `STALWART_DB_USER`
- `STALWART_DB_PASSWORD`
- `STALWART_DB_NAME`
- `STALWART_REDIS_PASSWORD`
- `STALWART_MINIO_ROOT_USER`
- `STALWART_MINIO_ROOT_PASSWORD`
- `STALWART_MINIO_BUCKET`
- `STALWART_MINIO_REGION`

## Configure The App To Use Stalwart

The app does not need a new provider for Stalwart. Use the existing nodemailer provider.

For the containerized stack, set `.env` like this:

```bash
EMAIL_PROVIDER=nodemailer
SMTP_HOST=stalwart
SMTP_PORT=587
SMTP_USER=your-stalwart-account@example.com
SMTP_PASS=your-stalwart-password
DEFAULT_FROM=your-stalwart-account@example.com
```

Because [server/email/providers/nodemailer.ts](c:/Users/AllanBosire/Desktop/email-service/server/email/providers/nodemailer.ts) treats port `465` as implicit TLS and all other ports as non-implicit TLS, `587` is the safest default for authenticated submission.

## Notes

- Stalwart is a full mail stack with mailbox protocols such as IMAP, POP3, SMTP, and JMAP
- Unlike Postal, it is suitable for employee mailboxes as well as SMTP relay
- Mail-related DNS records and hostnames should be `DNS only`, not proxied through Cloudflare
- Keep exactly one SPF record per domain

## Official Stalwart References

- Overview: `https://stalw.art/`
- Docker install: `https://stalw.art/docs/install/platform/docker`
- DNS setup: `https://stalw.art/docs/install/dns`
