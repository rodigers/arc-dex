# ArcSwap v2 — Advanced Feature Rebuild

You are upgrading /home/ubuntu/arc-dex (Next.js 15 + TS + Tailwind v4 + Circle App Kit) into a professional DEX. Read existing app/page.tsx, components/*, lib/* FIRST to match APIs.

## HARD RULES
- No new npm packages except none — react/tailwind/viem/geist only.
- TypeScript strict, zero tsc errors at the end (run npx tsc --noEmit).
- Keep white/black minimal theme, Geist fonts, CSS vars from globals.css.
- Do not break existing swap/bridge logic in lib/appkit.ts and lib/bridge.ts.
- Mobile-first (360px), max-w-md column.

## ASSETS ALREADY PRESENT
- public/tokens/usdc.png (real USDC logo), public/tokens/eurc.png (EURC logo). Use next/image or <img> with these everywhere tokens appear. NEVER render colored letter circles again for USDC/EURC.

## TASK 1 — Token identity overhaul (lib/tokens.ts + components/TokenBadge.tsx)
- Rename NATIVE display to "USDC" with sub-label "Gas token". Keep symbol NATIVE only for App Kit calls.
- lib/tokens.ts: add per-token { logo: "/tokens/usdc.png" | "/tokens/eurc.png", name } fields.
- TokenBadge.tsx: replace TokenDot colored circles with real logo images (rounded-full img). Keep component API compatible.

## TASK 2 — TokenPicker modal (new components/TokenPicker.tsx)
- Full-screen overlay modal listing all tokens: logo, symbol, name, user balance right-aligned.
- Search input filtering by symbol/name.
- Selected callback sets pay or receive token. Trigger from clicking any token selector chip.

## TASK 3 — Price chart + market data (new components/PriceChart.tsx + lib/market.ts)
- lib/market.ts: fetch 24h prices from CoinGecko free API:
  https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,euro-coin&vs_currencies=usd&include_24hr_change=true
  and sparkline:
  https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days=1
  Handle failures gracefully (return null, chart shows placeholder).
- PriceChart.tsx: inline SVG sparkline (polyline) of last 24h, current price + 24h % change colored green/red. No chart library — hand-rolled SVG.
- Show one chart card above swap card (token switchable USDC/EURC).

## TASK 4 — Portfolio card (components/Portfolio.tsx)
- Sum balances * price (prices from lib/market.ts) = Total value in USD.
- Rows per token with logo, balance, usd value, 24h change badge.
- Eye toggle to hide amounts (privacy), persisted in localStorage.

## TASK 5 — Swap confirmation modal with simulation (components/SwapConfirmModal.tsx)
- Before calling kit.swap(), show clean centered modal reviewing: You pay (logo+amount), You receive (logo+amount), rate, min received after slippage, price impact (colored), network fee estimate, deadline.
- Include a "Simulate" step: call kit.estimateSwap once more inside the modal on open; show ✓ Simulation passed (green check row) or ✗ error details. Only then enable the Confirm button.
- Confirm → executes the actual swap. Cancel → closes, no tx.

## TASK 6 — Gas estimator
- In SwapConfirmModal show estimated fee: use viem publicClient.estimateGas for a dummy transfer + gasPrice from RPC https://rpc.testnet.arc.io; convert to USDC (native=USDC, 18 dec → human). Cache result 60s. If estimation fails show "≈ <0.01 USDC".

## TASK 7 — Live tx history (upgrade components/RecentSwaps.tsx)
- Merge sources: localStorage entries (existing) + on-chain history via ArcScan API if reachable: try GET https://api.arcscan.app/v1/addresses/{address}/transactions?limit=10 — if fetch fails silently fall back to localStorage-only. Render unified list: logo pair, in/out amounts, time ago, status dot, explorer link.

## TASK 8 — UX polish across page.tsx
- Persist last used tokens + slippage in localStorage (key arcswap_prefs), restore on mount.
- "50%" quick button next to MAX.
- Number ticker animation: when quote updates, animate number counting from old to new over 300ms (simple rAF hook, new lib/useCountUp.ts).
- Empty states: no wallet → friendly illustration-ish block (SVG inline, black/white); wrong network → red banner with Switch button (exists — keep).
- Copy address button in wallet pill (navigator.clipboard + toast "Address copied").
- Keyboard: T flips tokens, R refetches balances+quotes (ignore when typing in inputs).

## EXECUTION ORDER
Do tasks 1→8 sequentially. After each task run npx tsc --noEmit; do not accumulate errors. Finish only when ALL tasks done AND tsc passes AND every file you touched compiles.

Report at end: list of files created/modified.
