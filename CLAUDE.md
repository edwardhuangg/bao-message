# CLAUDE.md — Bao Message

Project conventions for Claude Code. Read HANDOFF.md first.

## Project
Invite-only mobile-first chat PWA. Next.js 15 App Router + TypeScript + Tailwind, Supabase (Auth/Postgres/Realtime), tweetnacl for E2EE. Deployed on Vercel free tier. Package manager: pnpm.

## Commands
- `pnpm dev` — local dev
- `pnpm build && pnpm start` — prod check before deploying
- `pnpm lint` / `pnpm typecheck` (`tsc --noEmit`)
- `supabase db push` if using Supabase CLI migrations; otherwise paste `docs/SCHEMA.sql` into the SQL editor

## Structure
```
src/
  app/            routes: /(auth)/login, /(app)/chats, /(app)/chats/[id], /(app)/profile, /api/ping
  components/     ui primitives (Bubble, Avatar, Composer, ChatListItem, TopBar)
  lib/supabase/   client.ts (browser), server.ts (SSR), types.ts (generated)
  lib/crypto/     keys.ts, box.ts, storage.ts  (Phase 2)
  lib/hooks/      useMessages, useConversations, useProfile
docs/             DESIGN.md, SECURITY.md, SCHEMA.sql
```

## Rules
- **Security first.** Never disable RLS. Never use the service-role key in client code. All data access goes through the anon key + RLS, or a server route using the user's session.
- **Ciphertext columns from day one.** `messages.body` is plaintext in Phase 1 and gets replaced by `ciphertext` + `nonce` in Phase 2 — keep the shape ready (see SCHEMA.sql). Do not build UI that assumes plaintext is permanent.
- **Mobile viewport is the design target.** Test at 390×844. Desktop just centers a phone-width column.
- **Keep dependencies minimal.** No UI kits, no state libraries. React state + Supabase client is enough.
- **Realtime**: one subscription per open conversation; unsubscribe on unmount. Use `postgres_changes` filtered on `conversation_id`.
- **Optimistic UI** on send, reconcile with the realtime echo by message `id` (generate UUID client-side).
- **Types**: run `supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts` after schema changes.
- Small commits with clear messages per phase step. Don't start Phase 2 until Phase 1's definition-of-done in HANDOFF.md is met.
- When unsure about a product decision, check HANDOFF.md §5; if not answered there, pick the simpler option and note it in `DECISIONS.md`.
