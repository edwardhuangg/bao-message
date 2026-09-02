# DECISIONS.md
Log of product/tech decisions made while building. Append as you go.

- 2026-09-02 — Stack: Next.js + Supabase + Vercel, tweetnacl for E2EE. Python rejected (needs a persistent host; auth/realtime rebuilt by hand).
- 2026-09-02 — Auth: magic link only, no passwords.
- 2026-09-02 — E2EE deferred to Phase 2 but schema columns exist from day one.
- 2026-09-02 — Scaffolded with Next.js 16.3.4 (create-next-app@latest no longer offers 15) + Tailwind 4. App Router unchanged; palette defined via CSS `@theme` instead of tailwind.config.
- 2026-09-02 — Dropped `@ducanh2912/next-pwa` (webpack plugin; Next 16 builds with Turbopack). PWA = App Router `manifest.ts` + minimal hand-rolled `public/sw.js` instead. Icons rendered from `assets/bao-icon.svg` by `scripts/generate-icons.mjs` (sharp, devDep).
- 2026-09-02 — DB row types hand-written in `src/lib/supabase/types.ts` for now; swap for `supabase gen types` output once the CLI is linked.
- 2026-09-02 — Supabase keep-alive: daily Vercel Cron (`vercel.json`) hitting `/api/ping`.
- 2026-09-02 — RLS verified by `scripts/rls-check.mjs` (creates two throwaway password users via service role key, asserts non-members are locked out, cleans up). App itself stays magic-link only.
- 2026-09-02 — Vercel gotcha: Framework Preset must be "Next.js" — with "Other" the build succeeds but deployment fails looking for a static output dir.
