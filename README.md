# Email Service

Production-ready email service with queue processing, provider-agnostic architecture, and monitoring dashboard.

## Quick Start

### 1. Docker Compose

```bash
docker compose -f docker-compose.yml -f docker-compose.postal.yml --env-file .env up -d
```

This starts the app, PostgreSQL, Redis, Listmonk, and Postal on the internal Docker network.
Postal and Listmonk configuration artifacts are generated automatically by one-shot init services during startup, so no separate prepare step is required for Dokploy-style deployments.
Use Traefik or another reverse proxy to publish the services you want externally.

If you only want the app stack plus Listmonk:

```bash
docker compose -f docker-compose.yml --env-file .env up -d
```

### 2. Local Development

```bash
cp .env.example .env
# Edit .env with your provider credentials and real hostnames.

pnpm install
pnpm db:push
pnpm dev
```

Important: the current compose files use `expose` instead of `ports`. That works for a fully containerized setup behind Traefik, but it means the native `pnpm dev:start*` flow no longer exposes Postgres or Redis to your host. If you want Nuxt to run on your host, you must either publish those ports again or point the app at other reachable database and Redis hosts.

### 3. Access

| URL                                     | Description          |
| --------------------------------------- | -------------------- |
| `https://your-app-host`                 | API key registration |
| `https://your-app-host/dashboard/login` | Dashboard login      |
| `https://your-app-host/dashboard`       | Monitoring dashboard |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Nuxt 4 Application                     │
├──────────────┬───────────────┬───────────────────────────┤
│   Frontend   │   API Layer   │      Queue Worker         │
│  (Nuxt UI +  │  (Nitro H3)   │     (BullMQ)             │
│   ECharts)   │               │                           │
├──────────────┼───────────────┼───────────────────────────┤
│              │               │                           │
│  Dashboard   │  POST /send   │  EmailProvider Interface  │
│  /dashboard  │  POST /api/key│  ├─ NodemailerProvider    │
│              │  GET  /api/*  │  ├─ ResendProvider        │
│              │               │  ├─ SendGridProvider      │
│              │               │  ├─ MailchimpProvider     │
│              │               │  └─ PostalProvider        │
├──────────────┴───────────────┴───────────────────────────┤
│           PostgreSQL          │         Redis             │
│    (api_keys, emails)         │   (BullMQ job queue)      │
└───────────────────────────────┴──────────────────────────┘
```

## API Usage

### Register for an API Key

```bash
curl -X POST http://localhost:3000/api/key \
  -H "Content-Type: application/json" \
  -d '{"email": "user@ifkafin.com"}'
```

### Send an Email

```bash
curl -X POST http://localhost:3000/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Hello",
    "text": "Hello from the email service!"
  }'
```

## Adding a New Email Provider

1. Create `server/email/providers/your-provider.ts` implementing `EmailProvider`
2. Add the case in `server/email/providers/index.ts`
3. Set `EMAIL_PROVIDER=your-provider` in `.env`

## Using Resend

Update `.env` to use Resend:

```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxx
DEFAULT_FROM=onboarding@resend.dev
```

Replace `re_xxxxxxxxx` with your real Resend API key before starting the app. If you move off the Resend test sender, verify your own sending domain in Resend and set `DEFAULT_FROM` to that address.

Equivalent Resend SDK example:

```ts
import { Resend } from "resend";

const resend = new Resend("re_xxxxxxxxx");

await resend.emails.send({
  from: "onboarding@resend.dev",
  to: "allan.bosire@ifkafin.com",
  subject: "Hello World",
  html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
});
```

## Using SendGrid

Update `.env` to use SendGrid:

```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxx
DEFAULT_FROM=verified-sender@example.com
```

Replace `SG.xxxxxxxx` with your real SendGrid API key before starting the app. `DEFAULT_FROM` must be a verified sender or a verified domain in SendGrid.

Equivalent SendGrid SDK example:

```ts
import sgMail from "@sendgrid/mail";

sgMail.setApiKey("SG.xxxxxxxx");

await sgMail.send({
  from: "verified-sender@example.com",
  to: "allan.bosire@ifkafin.com",
  subject: "Hello World",
  html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
});
```

## Using Mailchimp Transactional

Update `.env` to use Mailchimp Transactional:

```bash
EMAIL_PROVIDER=mailchimp
MAILCHIMP_TRANSACTIONAL_API_KEY=your-mailchimp-transactional-api-key
DEFAULT_FROM=verified-sender@example.com
```

Replace `your-mailchimp-transactional-api-key` with your real Mailchimp Transactional API key before starting the app. `DEFAULT_FROM` must be a sender that your Mailchimp Transactional account is allowed to send from.

Equivalent Mailchimp Transactional SDK example:

```ts
import mailchimpTransactional from "@mailchimp/mailchimp_transactional";

const mailchimp = mailchimpTransactional("your-mailchimp-transactional-api-key");

await mailchimp.messages.send({
  message: {
    from_email: "verified-sender@example.com",
    to: [{ email: "allan.bosire@ifkafin.com", type: "to" }],
    subject: "Hello World",
    html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
  },
});
```

## Using Postal

Postal setup is documented in detail in [docs/postal/README.md](/home/allanbosire/Desktop/chiba/email-service/docs/postal/README.md).

Minimum app configuration:

```bash
EMAIL_PROVIDER=postal
POSTAL_API_URL=http://postal-web:5000
POSTAL_SERVER_API_KEY=postal_server_api_key
DEFAULT_FROM=verified-sender@example.com
```

For the fully containerized stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.postal.yml --env-file .env up -d
```

Postal does not come with a default UI username/password in this repo. Create the first admin user with:

```bash
docker compose -f docker-compose.yml -f docker-compose.postal.yml exec postal-web postal make-user
```

Use the email and password you enter in that prompt to sign in to the Postal UI.

If you are running the app outside Docker, replace `POSTAL_API_URL` with your Traefik hostname or another externally reachable Postal URL.

Use the dedicated guide for the full Postal bootstrapping flow, DNS records, Postal UI setup, and delivery requirements.

See [docs/postal/README.md](/home/allanbosire/Desktop/chiba/email-service/docs/postal/README.md).

## Using Listmonk

Listmonk is integrated here as a proxied mailing-list service, not as an email provider.

The containerized stack in [docker-compose.yml](/home/allanbosire/Desktop/chiba/email-service/docker-compose.yml) includes Listmonk by default. In Docker Compose, point the app at `http://listmonk-app:9000`; if you are calling Listmonk from outside Docker, use your Traefik hostname instead.

Use the dedicated guide for the Listmonk overlay, proxy configuration, and dashboard API usage.

See [docs/listmonk/README.md](/home/allanbosire/Desktop/chiba/email-service/docs/listmonk/README.md).

## Startup Validation

The server validates the selected email provider configuration during Nitro startup. If the selected provider is missing required environment variables, startup fails with a provider-specific error message that lists the missing or invalid keys.

## Dashboard Test Email

Authenticated dashboard users can queue a test email to their own login address from the dashboard UI. The request goes through `POST /api/dashboard/test-email`, inserts a queued email record, and uses the configured provider through the normal worker flow.

## Scripts

| Script             | Description              |
| ------------------ | ------------------------ |
| `pnpm dev`         | Start development server |
| `pnpm dev:start:all` | Start Nuxt on the host plus the Postal and Listmonk overlays; requires host-reachable database and Redis services |
| `pnpm dev:start`   | Start Postgres + Redis + Nuxt via the local orchestrator; requires published ports or other host-reachable services |
| `pnpm dev:start:listmonk` | Start the base dev stack plus the Listmonk overlay; requires host-reachable database and Redis services |
| `pnpm dev:start:postal` | Start the base dev stack plus the Postal overlay; requires host-reachable database and Redis services |
| `pnpm listmonk:prepare` | Generate local Listmonk config files |
| `pnpm listmonk:prepare:force` | Regenerate Listmonk config files |
| `pnpm listmonk:preview` | Preview the generated Listmonk config without writing it |
| `pnpm listmonk:up` | Start the base dev stack and Listmonk overlay without Nuxt |
| `pnpm listmonk:down` | Stop the base dev stack and Listmonk overlay |
| `GET/POST /api/dashboard/listmonk/**` | Proxy authenticated dashboard requests to the Listmonk API |
| `pnpm postal:prepare` | Generate local Postal config files |
| `pnpm postal:prepare:force` | Regenerate Postal config and signing key |
| `pnpm postal:preview` | Preview the generated Postal config without writing it |
| `pnpm postal:up`   | Start the base dev stack and Postal overlay without Nuxt |
| `pnpm postal:down` | Stop the base dev stack and Postal overlay |
| `pnpm build`       | Build for production     |
| `pnpm db:push`     | Push schema to database  |
| `pnpm db:generate` | Generate migrations      |
| `pnpm db:migrate`  | Run migrations           |
| `pnpm db:studio`   | Open Drizzle Studio      |

## Environment Variables

See [.env.example](.env.example) for all configuration options.
