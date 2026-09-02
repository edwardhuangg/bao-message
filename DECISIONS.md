# DECISIONS.md
Log of product/tech decisions made while building. Append as you go.

- 2026-09-02 — Stack: Next.js + Supabase + Vercel, tweetnacl for E2EE. Python rejected (needs a persistent host; auth/realtime rebuilt by hand).
- 2026-09-02 — Auth: magic link only, no passwords. **Superseded 2026-09-03.**
- 2026-09-02 — E2EE deferred to Phase 2 but schema columns exist from day one.
- 2026-09-02 — Scaffolded with Next.js 16.3.4 (create-next-app@latest no longer offers 15) + Tailwind 4. App Router unchanged; palette defined via CSS `@theme` instead of tailwind.config.
- 2026-09-02 — Dropped `@ducanh2912/next-pwa` (webpack plugin; Next 16 builds with Turbopack). PWA = App Router `manifest.ts` + minimal hand-rolled `public/sw.js` instead. Icons rendered from `assets/bao-icon.svg` by `scripts/generate-icons.mjs` (sharp, devDep).
- 2026-09-02 — DB row types hand-written in `src/lib/supabase/types.ts` for now; swap for `supabase gen types` output once the CLI is linked.
- 2026-09-02 — Supabase keep-alive: daily Vercel Cron (`vercel.json`) hitting `/api/ping`.
- 2026-09-02 — RLS verified by `scripts/rls-check.mjs` (creates two throwaway password users via service role key, asserts non-members are locked out, cleans up). App itself stays magic-link only.
- 2026-09-02 — Vercel gotcha: Framework Preset must be "Next.js" — with "Other" the build succeeds but deployment fails looking for a static output dir.
- 2026-09-03 — Login gained a 6-digit OTP code path: PKCE magic links only verify in the requesting browser, which breaks in phone mail-app webviews. Requires the owner to put {{ .TokenHash }} link + {{ .Token }} code into the Magic Link AND Confirm signup email templates.
- 2026-09-03 — Phase 2 E2EE shipped with zero schema changes (Phase 2 tables existed from day one). Conversation keys are wrapped sealed-box style (ephemeral keypair per wrap, eph. pubkey prepended inside wrapped_key) so an identity reset never breaks others' unwraps. "Current key" = highest version the device can unwrap — sidesteps the creator-only UPDATE policy on conversations.key_version.
- 2026-09-03 — Key recovery: plaintext `__bao:key_request` / `__bao:left` control messages (filtered from UI) trigger any keyed member's client to rotate to a new wrapped version; manual "Re-share encryption keys" button as fallback. Backup passphrase is mandatory at setup; reset = old messages permanently locked (stated in UI).
- 2026-09-03 — Auth switched to email + password, zero outgoing email (owner's call: magic links broke in phone mail webviews, Supabase's built-in sender is rate-limited to ~2/hour, and template edits demanded custom SMTP — too heavy for a friends app). Allowlist trigger still gates signups server-side; "Confirm email" must be OFF in the dashboard; forgotten passwords are reset by the host via scripts/reset-password.mjs. /auth/callback and all OTP UI removed.
- 2026-09-03 — Messages sent before Phase 2 keep their plaintext body and stay readable in the UI (no UPDATE policy on messages to encrypt them in place; day-one test chatter only). Owner can purge with: delete from public.messages where body is not null and body not like '\_\_bao:%';
