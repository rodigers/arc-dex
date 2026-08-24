# TASK5 — Visual Polish Layer (no new features, design only)

/home/ubuntu/arc-dex — Next.js 15 + Tailwind v4. Read app/globals.css and app/page.tsx first.

## GOAL
Kill the "empty plain page" feel with a professional ambient visual layer. The result must feel like Linear/Vercel/Stripe: calm, premium, alive — NOT busy, NOT colorful chaos, NOT a crypto cliché. Zero new features. Zero clutter.

## 1. Animated background (app/globals.css + tiny component)
- Add `components/AmbientBackground.tsx`: a fixed inset-0 -z-10 layer containing:
  a) The existing subtle grid (keep grid-bg class usage).
  b) TWO large blurred radial gradient orbs (one black/5% opacity top-left, one blue-500/8% bottom-right — in dark mode invert to white/4% and blue-400/6%), slowly drifting via CSS keyframes (translate + scale, 40s and 55s loops, alternate direction). Blur ~120px. GPU-friendly: only animate transform.
  c) Optional: very subtle noise texture overlay using an inline SVG feTurbulence data-URI at 2-3% opacity for that film-grain premium feel.
- Respect prefers-reduced-motion: disable drift animations entirely.
- Mount it once in app/layout.tsx behind everything.

## 2. Micro-interactions (globals.css utilities)
- `.card-hover`: translateY(-2px) + shadow deepen on hover, transition 200ms ease-out.
- Buttons already have active:scale; add focus-visible rings (accent color) everywhere interactive.
- Smooth view transitions between tabs: wrap tab content in a keyed div with a small fade+slide-up animation (@keyframes fadeUp 240ms cubic-bezier(0.16,1,0.3,1)).
- Number changes: existing useCountUp stays.
- Toasts: add slide-in-from-right animation.

## 3. Depth & rhythm
- Increase card shadow softness slightly (larger blur, lower opacity).
- Section gaps: consistent 20px rhythm on mobile, 24px desktop.
- Header: add backdrop-blur + border-b when scrolled >8px (small scroll listener in page.tsx).

## 4. Dark mode polish
- Verify dark mode orbs/grid look right (grid lines white at low opacity).
- Card backgrounds in dark: #101012 with border #1f1f23 (already close).

## 5. Empty-state visuals (tiny inline SVGs, monochrome)
- Wherever a list can be empty (RecentSwaps, Portfolio before connect, alerts), show a centered minimal line-art SVG icon + one sentence. No emoji.

## CONSTRAINTS
- Do NOT touch business logic files: lib/appkit.ts, lib/bridge.ts, lib/balances.ts, components/BridgePanel.tsx swap logic, SwapConfirmModal logic.
- No new dependencies. All CSS/SVG hand-rolled.
- Performance: animations use transform/opacity only. No JS animation loops except existing count-up.
- After all edits: npx tsc --noEmit clean.

Report: files touched + what each visual change does.
