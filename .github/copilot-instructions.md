# Project Guidelines

## Architecture

- This repo is a Nuxt 4 monolith. Keep UI work in `app/`, Nitro handlers in `server/api/` and `server/routes/`, shared cross-runtime helpers in `shared/`, and persistence in `server/database/`.
- Preserve the current boundaries: public email sending flows through `server/routes/send.post.ts`, dashboard auth and metrics live under `server/api/dashboard/`, and API key management lives under `server/api/key.post.ts` and `server/api/keys/`.
- Email delivery is provider-agnostic and queue-backed. New provider work should follow `server/email/types.ts`, register in `server/email/providers/index.ts`, and keep BullMQ job behavior aligned with `server/queue/email.queue.ts` and `server/queue/email.worker.ts`.

## Build And Test

- Use `pnpm` for all package scripts.
- For local server work, start PostgreSQL and Redis first with `docker compose up -d` or `pnpm dev:start`, then copy `.env.example` to `.env`, run `pnpm db:push`, and start the app with `pnpm dev`.
- Use `pnpm test:run` for one-off verification and `pnpm test` only when watch mode is useful.
- When changing the Drizzle schema in `server/database/schema.ts`, follow up with the appropriate database workflow: `pnpm db:generate`, `pnpm db:migrate`, or `pnpm db:push`.
- See `README.md` for setup and API usage details instead of duplicating them here.

## Conventions

- Prefer the repo's existing Nuxt and Nitro auto-import style. In server files, use framework helpers such as `defineEventHandler`, `createError`, `readValidatedBody`, `getCookie`, and `getHeader` the same way existing handlers do unless a file already uses explicit imports.
- Validate request bodies with Zod and `readValidatedBody(event, schema.safeParse)`. Follow the handler patterns in `server/api/key.post.ts` and `server/routes/send.post.ts` for structured validation and auth failures.
- Keep auth paths separate: API key auth belongs in the public send flow and shared helpers under `server/utils/auth.ts`; dashboard authentication uses JWT cookies and middleware under `server/middleware/` and `app/middleware/`.
- Reuse shared email-domain validation from `shared/utils/utils.ts`. Allowed domains come from environment variables, so avoid hardcoding domain checks in new handlers or components.
- Keep data model conventions intact: ULIDs for primary identifiers, SHA-256 hashing for stored API keys, and key prefixes rather than raw keys in persisted records.
- Match the existing test style in `tests/`: Vitest, async-first assertions, and focused utility or route-adjacent coverage instead of broad integration scaffolding.

## Environment Gotchas

- `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` are required for most server-side work. Missing values cause hard failures in database, queue, or dashboard-auth flows.
- The BullMQ worker is started from `server/plugins/queue.ts`. Build-only or isolated unit-test runs do not exercise queued email delivery unless Redis is available and the server plugin is active.
- Dashboard pages under `/dashboard/**` are client-rendered via route rules in `nuxt.config.ts`. Do not assume SSR behavior when changing those pages or their middleware.