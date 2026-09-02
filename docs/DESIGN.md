# DESIGN.md — Bao Message UI

Goal: feels like LINE — soft, friendly, uncluttered — but stripped to essentials. Three screens only.

## Brand
- Name: **Bao Message** (app label "Bao").
- Palette (Tailwind config `colors.bao`):
  - `cream` #FFF8F0 (app background)
  - `steam` #F2EDE6 (incoming bubble)
  - `bao` #FFD6A5 (accent / outgoing bubble) — warm peach
  - `ink` #2B2B2B (primary text)
  - `mute` #8A8A8A (timestamps, secondary)
  - `leaf` #7FC8A9 (online dot, success)
  - `danger` #E5766D
- Dark mode: optional, later. Ship light only in Phase 1.
- Type: system font stack (`-apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`) — renders Japanese well, zero load cost. Body 16px, bubbles 15px, meta 12px.
- Icon/logo: round bun silhouette with three pleats on top and a small steam curl shaped like a speech bubble. Generate as SVG; export 192/512 PNG for the PWA manifest and an apple-touch-icon.
- Radius: bubbles 18px, cards 14px, buttons pill.

## Screens

### 1. Chats list  `/chats`
- Top bar: "Bao" wordmark left, small profile avatar right (tap → profile).
- List rows: avatar (colored circle with initial or emoji), name, last message preview (1 line, grey), time right-aligned, unread dot in `leaf`.
- Floating "+" pill button bottom-right → new chat sheet (pick one or more people from allowlisted users).
- Empty state: bun illustration + "No chats yet. Tap + to start one."

### 2. Chat  `/chats/[id]`
- Top bar: back chevron, name (group: member names joined), overflow "…" (members, leave).
- Message stream:
  - Outgoing: right-aligned, `bao` background, `ink` text.
  - Incoming: left-aligned, `steam` background; show sender name above bubble only in groups; avatar at left of first bubble in a run.
  - Group consecutive messages from same sender within 2 min (tighter spacing, no repeated avatar).
  - Time stamp small grey beside bubble; date divider chip ("Today", "Tue, Sep 1") between days.
  - Auto-scroll to bottom on new message if user is already near bottom; else show "↓ New" pill.
- Composer (sticky bottom, respects iOS safe area):
  - Rounded text field, grows to 5 lines, Enter = newline on mobile, Send button (paper-plane icon) turns `bao` when text present.
  - Optional emoji button. No attachments in Phase 1.
- Sending states: optimistic bubble at 70% opacity → solid on confirm; small red "!" + retry on failure.

### 3. Profile  `/profile`
- Big avatar, display name (editable), email (read-only), avatar color/emoji picker, "Sign out."
- Phase 2 adds: "Back up my encryption key" (QR + passphrase) and device info.

### Auth  `/login`
- Centered card: logo, "Welcome to Bao", email input, "Send magic link". Success state: "Check your email." Error for non-allowlisted: "This email isn't on the guest list yet — ask the host."

## Interaction details
- Every tap target ≥ 44px.
- Haptic-feel micro transitions: bubble fade/slide-in 120ms, no bouncy animations.
- Pull-to-refresh not needed (realtime). Show a subtle "Reconnecting…" banner if the Realtime channel drops.
- PWA: `display: standalone`, theme color `cream`, splash icon. Test "Add to Home Screen" on iOS Safari and Android Chrome.
- Desktop: render the app in a max-width 480px centered column on `cream` with a faint shadow. Don't build a separate desktop layout.

## Accessibility
- Color contrast ≥ 4.5:1 for text on all bubbles (check `ink` on `bao`).
- aria-live polite on the message list.
- Respect `prefers-reduced-motion`.
