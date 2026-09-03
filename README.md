# Bao Message 🥟

A private, invite-only chat for a small group of friends. Mobile-first PWA, LINE-flavored, end-to-end encrypted (Phase 2).

Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Auth / Postgres / Realtime), tweetnacl. Hosted on Vercel, free tiers only.

**Live:** https://bao-message-rose.vercel.app

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

## Adding a friend

**Easiest (works always):** create their account directly — allowlists them, no email involved:

```sh
node scripts/create-user.mjs friend@example.com "temp-password"
```

Tell them the temp password privately; they sign in and change it in Profile.

**Self-signup alternative:** add just their email to the allowlist and let them use "Create account" on the login page:

```sql
insert into public.allowlist (email, note) values ('friend@example.com', 'friend');
```

Self-signup requires "Confirm email" to be OFF in Supabase (see Auth section below); the trigger rejects non-allowlisted emails either way.

## Auth (email + password, no email service)

Sign-in is plain email + password — no emails are ever sent. The invite gate still holds: a database trigger rejects any signup whose email isn't in `allowlist`. One-time Supabase setting for this to work: **Authentication → Sign In / Providers → Email → turn OFF "Confirm email"** (otherwise signups wait for a confirmation email that never sends).

Forgot password? No reset emails exist — the host runs:

```sh
node scripts/reset-password.mjs friend@example.com "temporary-password"
```

and tells them out-of-band; they change it afterwards in Profile. (The encryption backup passphrase is separate and can never be reset by anyone.)

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm build
node scripts/rls-check.mjs    # verifies row-level security (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)
node scripts/e2e-chat.mjs     # two-user chat flow incl. realtime delivery (same key requirement)
node scripts/e2ee-check.mjs   # SECURITY.md Phase 2 checklist: ciphertext-only storage, wrapping, rotation, backup restore
node scripts/generate-icons.mjs  # re-render PWA icons after editing assets/bao-icon.svg
```

## Encryption (Phase 2)

Messages are end-to-end encrypted in the browser with tweetnacl; the server stores only ciphertext.

- Each device holds an X25519 identity key in IndexedDB (never uploaded); the public half lives in `profiles.public_key`.
- Each conversation has a symmetric key, sealed-box-wrapped per member in `conversation_keys` (versioned — rotation adds a version, old messages stay readable).
- First login prompts for a **backup passphrase** (PBKDF2-SHA256, 600k iterations) that encrypts the identity key into `key_backups` — that's how a new phone restores history. Lost devices + forgotten passphrase = history is unrecoverable, by design.
- If someone gets locked out (reset/new identity), their app posts a `__bao:key_request` control message and any member's app re-wraps a fresh key version for everyone; there's also a manual "Re-share encryption keys" button in the chat's member sheet. Leaving a chat rotates the key to exclude the leaver.
- **What E2EE does not hide:** metadata — who talks to whom, when, message sizes, display names. Verify with `node scripts/e2ee-check.mjs`.

## Keep-alive

Supabase free projects pause after ~7 days of inactivity. `vercel.json` schedules a daily Vercel Cron request to `/api/ping` (a one-row `select`) to prevent that.
