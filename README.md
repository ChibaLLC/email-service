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
# Edit .env with your SMTP credentials

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
│              │  GET  /api/*  │  ├─ (ResendProvider)      │
│              │               │  └─ (SendGridProvider)    │
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
