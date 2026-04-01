# Email Service

Production-ready email service with queue processing, provider-agnostic architecture, and monitoring dashboard.

## Quick Start

### 1. Docker Compose (PostgreSQL + Redis)

```bash
docker compose up -d
```

### 2. Local Development

```bash
cp .env.example .env
# Edit .env with your provider credentials

pnpm install
pnpm db:push        # Push schema to PostgreSQL
pnpm dev            # Start dev server
```

### 3. Access

| URL                                     | Description          |
| --------------------------------------- | -------------------- |
| `http://localhost:3000`                 | API key registration |
| `http://localhost:3000/dashboard/login` | Dashboard login      |
| `http://localhost:3000/dashboard`       | Monitoring dashboard |

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
│              │               │  └─ MailchimpProvider     │
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

## Startup Validation

The server validates the selected email provider configuration during Nitro startup. If the selected provider is missing required environment variables, startup fails with a provider-specific error message that lists the missing or invalid keys.

## Dashboard Test Email

Authenticated dashboard users can queue a test email to their own login address from the dashboard UI. The request goes through `POST /api/dashboard/test-email`, inserts a queued email record, and uses the configured provider through the normal worker flow.

## Scripts

| Script             | Description              |
| ------------------ | ------------------------ |
| `pnpm dev`         | Start development server |
| `pnpm build`       | Build for production     |
| `pnpm db:push`     | Push schema to database  |
| `pnpm db:generate` | Generate migrations      |
| `pnpm db:migrate`  | Run migrations           |
| `pnpm db:studio`   | Open Drizzle Studio      |

## Environment Variables

See [.env.example](.env.example) for all configuration options.
