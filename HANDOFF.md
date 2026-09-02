# Bao Message — Handoff Brief (START HERE)

You are building **Bao Message**: a private, invite-only chat app for a small group of friends (think LINE / WhatsApp, but tiny). Mobile-first web app, installable as a PWA. Free hosting. Encrypted so it isn't trivially readable if the database leaks.

Read in this order: `HANDOFF.md` → `CLAUDE.md` → `docs/DESIGN.md` → `docs/SECURITY.md` → `docs/SCHEMA.sql`.

---

## 1. What the owner wants (plain English)

- A chat space only people they choose can access.
- Each person creates an account once and keeps messaging under their name.
- Messages are text only for v1. Usage is tiny: a handful of people, single messages.
- Encrypted — not "extremely vulnerable." Real end-to-end encryption is the goal (see SECURITY.md), delivered in Phase 2 after the plain app works.
- Mobile UI: beautiful but simple, LINE-like. Not a Slack clone.
- Name: **Bao Message** (short form "Bao"). Logo idea: a round steamed bun with a tiny speech-bubble steam curl.
- Cost: $0. Free tiers only.

## 2. Stack decision (already made — don't re-litigate unless something is broken)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + TypeScript + Tailwind** | PWA-friendly, easy Vercel deploy, one codebase |
| Backend / DB / Realtime / Auth | **Supabase** (Postgres + Realtime + Auth + Row Level Security) | Free tier, live message delivery via `postgres_changes`, auth built in, no server to run |
| Hosting | **Vercel** free tier | Zero config for Next.js |
| Crypto | **tweetnacl** + `tweetnacl-util` (in browser) | Small, audited, simple API (`box`, `secretbox`) |
| Package manager | pnpm | |

Why not Python: a Python/FastAPI + WebSocket server would need a running host (Fly/Railway free tiers are unreliable now) and you'd rebuild auth + realtime by hand. Supabase gives all three for free.

**Known free-tier caveats — tell the owner:**
- Supabase free projects **pause after ~7 days of inactivity**. Fix: a free cron ping (Vercel Cron or cron-job.org) hitting a tiny `/api/ping` route that does a lightweight `select 1`.
- Supabase Realtime free tier: 200 concurrent connections, 2M messages/month. Irrelevant at this scale.
- Vercel free tier is for non-commercial use — fine here.

## 3. Build in phases. Finish each phase fully before starting the next.

### Phase 0 — Scaffold (30 min)
- `pnpm create next-app@latest bao-message --ts --tailwind --app --src-dir --eslint`
- Add `@supabase/supabase-js`, `@supabase/ssr`, `tweetnacl`, `tweetnacl-util`, `next-pwa` (or `@ducanh2912/next-pwa`), `lucide-react`.
- Create Supabase project; run `docs/SCHEMA.sql` in the SQL editor.
- `.env.local` from `.env.example`.
- Commit. Deploy to Vercel to confirm the pipeline works with a "Hello Bao" page.

### Phase 1 — Working plaintext chat (the MVP)
1. **Auth**: Supabase magic-link (email OTP). No passwords to leak.
2. **Invite gate**: signup only succeeds if the email exists in `allowlist` (enforced by a Postgres trigger in SCHEMA.sql — not just client-side). Owner adds emails via Supabase dashboard for now; an admin page can come later.
3. **Profile setup**: first login → choose display name + pick an avatar color/emoji. Stored in `profiles`.
4. **Conversations**: 1:1 and small groups. Any member can create a group and add allowlisted users.
5. **Messages**: send/receive text, live via Realtime subscription filtered by `conversation_id`. Optimistic insert on send.
6. **UI** per `docs/DESIGN.md`: chat list screen, chat screen, profile screen. That's it.
7. **RLS** on every table (in SCHEMA.sql). Verify: a user must NOT be able to read a conversation they aren't a member of. Write a quick test with two accounts.
8. PWA manifest + icons so it installs to the home screen on iOS/Android.
9. Deploy. Owner invites 2 friends and uses it for a day.

### Phase 2 — End-to-end encryption
Follow `docs/SECURITY.md` exactly. Summary: per-device keypair, per-conversation symmetric key wrapped for each member, server stores ciphertext only. Add key-backup export (QR / passphrase) so a new phone can read history.

### Phase 3 — Nice-to-haves (only if asked)
- Read receipts, typing indicator (Realtime Presence/Broadcast — cheap).
- Web Push notifications (needs VAPID keys; Supabase Edge Function on insert).
- Image messages (Supabase Storage, encrypt blob client-side before upload).
- Message deletion / edit.
- Stickers (LINE-flavor) — a small static set is fun and cheap.

## 4. Definition of done for Phase 1
- Two people on two phones can message each other in real time on the deployed URL.
- Someone not on the allowlist cannot sign up.
- A logged-in user cannot fetch another conversation's messages via the API (RLS verified).
- Lighthouse PWA installable, mobile performance ≥ 90.
- Repo README explains: how to add a person to the allowlist, how to run locally, env vars.

## 5. Things to ask the owner before Phase 2 (don't block Phase 1 on these)
- Should groups be possible, or 1:1 only? (Assume both.)
- Do they want message history to survive if someone loses their phone? (Affects key backup design — default: yes, via passphrase-encrypted key backup.)
- Custom domain? (e.g. bao.someone.com — Vercel free supports it.)
