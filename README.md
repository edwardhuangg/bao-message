# Bao Message 🥟

A private, invite-only chat for a small group of friends. Mobile-first PWA, LINE-flavored, end-to-end encrypted (Phase 2).

Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Auth / Postgres / Realtime), tweetnacl. Hosted on Vercel, free tiers only.

Start with [HANDOFF.md](HANDOFF.md), then [CLAUDE.md](CLAUDE.md), [docs/DESIGN.md](docs/DESIGN.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/SCHEMA.sql](docs/SCHEMA.sql).

## Run locally

```sh
pnpm install
cp .env.example .env.local   # fill in Supabase URL + anon key
pnpm dev
```

## Environment variables

| Var | What |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; only for a future allowlist admin route. Never expose to the client. |
| `PING_SECRET` | Optional secret for the `/api/ping` keep-alive cron |

## Adding someone to the guest list

Signups are rejected unless the email is in the `allowlist` table (enforced by a Postgres trigger). For now, add rows in the Supabase dashboard:

```sql
insert into public.allowlist (email, note) values ('friend@example.com', 'friend');
```

## Supabase auth config (one-time)

In Supabase → **Authentication → URL Configuration**:
- **Site URL**: your production URL, e.g. `https://bao-message.vercel.app`
- **Redirect URLs**: add `https://<your-prod-domain>/auth/callback` and `http://localhost:3000/auth/callback`

Without this, magic-link emails point at localhost.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm build
node scripts/rls-check.mjs    # verifies row-level security (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)
node scripts/e2e-chat.mjs     # two-user chat flow incl. realtime delivery (same key requirement)
node scripts/generate-icons.mjs  # re-render PWA icons after editing assets/bao-icon.svg
```

## Keep-alive

Supabase free projects pause after ~7 days of inactivity. `vercel.json` schedules a daily Vercel Cron request to `/api/ping` (a one-row `select`) to prevent that.
