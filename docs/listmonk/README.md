# Listmonk Setup

This guide covers the Listmonk-specific setup for this repo: starting the local Listmonk overlay, configuring the server-side Listmonk API proxy, and optionally wiring Listmonk to Postal for a fully local mail pipeline.

This repo supports two Listmonk usage modes:

- The containerized app stack in [docker-compose.yml](/home/allanbosire/Desktop/chiba/email-service/docker-compose.yml), which now includes Listmonk by default
- Local native-dev Listmonk via the compose overlay in [docker-compose.listmonk.yml](/home/allanbosire/Desktop/chiba/email-service/docker-compose.listmonk.yml)
- External Listmonk by pointing the app at an existing Listmonk instance with `LISTMONK_API_URL`

## What This Repo Provides

- A Listmonk proxy config helper in [server/listmonk/config.ts](/home/allanbosire/Desktop/chiba/email-service/server/listmonk/config.ts)
- Dashboard-authenticated Listmonk proxy routes in [server/api/dashboard/listmonk/index.ts](/home/allanbosire/Desktop/chiba/email-service/server/api/dashboard/listmonk/index.ts) and [server/api/dashboard/listmonk/[...path].ts](/home/allanbosire/Desktop/chiba/email-service/server/api/dashboard/listmonk/[...path].ts)
- Listmonk services in the main container stack at [docker-compose.yml](/home/allanbosire/Desktop/chiba/email-service/docker-compose.yml)
- A Listmonk compose overlay in [docker-compose.listmonk.yml](/home/allanbosire/Desktop/chiba/email-service/docker-compose.listmonk.yml)
- A Node-based Listmonk CLI in [scripts/listmonk.mjs](/home/allanbosire/Desktop/chiba/email-service/scripts/listmonk.mjs)
- Reusable Listmonk config helpers in [scripts/listmonk/config.mjs](/home/allanbosire/Desktop/chiba/email-service/scripts/listmonk/config.mjs) and [scripts/listmonk/env.mjs](/home/allanbosire/Desktop/chiba/email-service/scripts/listmonk/env.mjs)

## Quick Start

### 1. Start Listmonk

For the full containerized stack, use Docker Compose directly after generating the Listmonk config file:

```bash
pnpm listmonk:prepare
docker compose up -d
```

For native Nuxt development with only the infrastructure and Listmonk in containers:

```bash
pnpm dev:start:listmonk
```

This starts:

- PostgreSQL for this app
- Redis for this app
- Listmonk Postgres
- Listmonk web

If you want the full local stack with the app, Postal, and Listmonk together:

```bash
pnpm dev:start:all
```

The Listmonk helper commands are:

- `pnpm listmonk:prepare`
- `pnpm listmonk:prepare:force`
- `pnpm listmonk:preview`
- `pnpm listmonk:up`
- `pnpm listmonk:down`
- `pnpm listmonk:reset`

### 2. Configure the Listmonk proxy

Update `.env`:

```bash
LISTMONK_API_URL=http://localhost:9000
LISTMONK_USERNAME=api_user
LISTMONK_PASSWORD=api_token
```

Notes:

- `LISTMONK_API_URL` is the Listmonk web base URL, not the full `/api` endpoint
- `LISTMONK_USERNAME` and `LISTMONK_PASSWORD` are the API user's BasicAuth credentials

The app does not use Listmonk as an `EMAIL_PROVIDER`. Instead, it exposes a server-side proxy for authenticated dashboard traffic:

```text
/api/dashboard/listmonk/** -> LISTMONK_API_URL/api/**
```

This keeps Listmonk credentials on the server side instead of exposing them to the browser.

## Listmonk UI Setup

After the Listmonk overlay is running, open Listmonk at `http://localhost:9000` unless you changed `LISTMONK_APP_PORT`.

The minimum Listmonk-side setup is:

1. Create the Super Admin user on first launch, or preseed it with `LISTMONK_ADMIN_USER` and `LISTMONK_ADMIN_PASSWORD`.
2. Log in and create an API user with the permissions you need for the endpoints you plan to proxy.
3. Put that API user's username/token into `LISTMONK_USERNAME` and `LISTMONK_PASSWORD`.

Without the API user, the app cannot proxy authenticated requests to Listmonk even if the containers are running.

## Proxy Usage

Any authenticated dashboard request sent to `/api/dashboard/listmonk/**` is proxied to the corresponding Listmonk API path under `/api/**`.

Examples:

- `/api/dashboard/listmonk/lists` -> `/api/lists`
- `/api/dashboard/listmonk/subscribers` -> `/api/subscribers`
- `/api/dashboard/listmonk/tx` -> `/api/tx`

Query strings and request bodies are forwarded.

Because the route sits under `/api/dashboard`, it is already covered by the dashboard auth middleware in [server/middleware/dashboard-auth.ts](/home/allanbosire/Desktop/chiba/email-service/server/middleware/dashboard-auth.ts).

## Important Constraint

Listmonk remains a mailing-list and campaign system. It is not part of the app's `EMAIL_PROVIDER` selection. The actual mail provider for this app is still controlled by `EMAIL_PROVIDER`, such as Postal, SendGrid, Resend, Mailchimp, or Nodemailer.

## Running Everything Locally

If you want the whole flow running locally during development:

```bash
pnpm dev:start:all
```

That gives you:

- the Nuxt app
- the app's Postgres and Redis
- Postal web, worker, SMTP, and MariaDB
- Listmonk web and Postgres

To make Listmonk deliver through the local Postal stack, configure Listmonk's SMTP settings in its admin UI to use:

- host: `postal-smtp`
- port: `25`

That works because both overlays share the same merged compose project network when started through `pnpm dev:start:all`.

## Local Overlay Notes

The Listmonk CLI generates:

- `docker/listmonk/config/config.toml`
- `docker/listmonk/uploads/`

Those generated files are intentionally ignored by Git via [.gitignore](/home/allanbosire/Desktop/chiba/email-service/.gitignore).

`config.toml` is regenerated from env values each time you run `pnpm listmonk:prepare`, `pnpm listmonk:prepare:force`, `pnpm listmonk:up`, `pnpm listmonk:reset`, or `pnpm dev:start:listmonk`.

## Verifying The App Integration

1. Start the app with `pnpm dev:start:listmonk` or `pnpm dev:start:all`.
2. Confirm Listmonk opens at `http://localhost:9000`.
3. Make an authenticated request to `/api/dashboard/listmonk/lists` or another Listmonk API endpoint.
4. Confirm the response matches the Listmonk API and the credentials are not sent from the browser.

## Official Listmonk References

- Installation: `https://listmonk.app/docs/installation/`
- Configuration: `https://listmonk.app/docs/configuration/`
- APIs: `https://listmonk.app/docs/apis/apis/`
- Transactional API: `https://listmonk.app/docs/apis/transactional/`
- Templating: `https://listmonk.app/docs/templating/`