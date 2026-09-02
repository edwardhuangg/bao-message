# DECISIONS.md
Log of product/tech decisions made while building. Append as you go.

- 2026-09-02 — Stack: Next.js + Supabase + Vercel, tweetnacl for E2EE. Python rejected (needs a persistent host; auth/realtime rebuilt by hand).
- 2026-09-02 — Auth: magic link only, no passwords.
- 2026-09-02 — E2EE deferred to Phase 2 but schema columns exist from day one.
- 2026-09-02 — Scaffolded with Next.js 16.3.4 (create-next-app@latest no longer offers 15) + Tailwind 4. App Router unchanged; palette defined via CSS `@theme` instead of tailwind.config. PWA dep: `@ducanh2912/next-pwa` per HANDOFF; if it fights Next 16 in Phase 1, switch to `@serwist/next`.
