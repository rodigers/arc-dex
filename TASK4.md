# ArcSwap SuperApp — TASK4

You are upgrading /home/ubuntu/arc-dex (Next.js 15 + TS + Tailwind v4 + Circle App Kit) from a swap-only DEX into a complete onchain super-app. Read app/page.tsx, components/*, lib/* first.

## HARD RULES
- No new npm packages. TypeScript strict, `npx tsc --noEmit` after each task.
- Keep white/black theme, Geist, CSS vars, existing components intact (Swap/Bridge/Limit/DCA tabs stay).
- Mobile-first 360px. Desktop: the center column is the action stage; side columns host new modules.
- Chart data source is CoinGecko free API (already in lib/market.ts) — REAL data, no mock.

## NAVIGATION REDESIGN
Replace the current flat 4-tab bar with a proper left sidebar nav on desktop (icons+labels: Trade, Earn, Portfolio, Tools, Info) collapsing to icon-only rail at md; bottom tab bar on mobile. Tabs Swap/Bridge/Limit/DCA move INSIDE "Trade" section as sub-tabs of the center card. Everything else becomes a page-like view swapped into the center stage (keep SPA state, no router).

## NEW MODULES (build each as its own component, wire into nav)

1. components/FaucetPanel.tsx — Testnet faucet hub: cards for Circle faucet (faucet.circle.com), Arc RPC status check (ping eth_chainId live), and "request from bot" instructions. Show current gas balance prominently + one-click copy of wallet address for pasting into faucets.

2. components/StakePanel.tsx — Simulated staking vault (clearly labeled SIMULATION): deposit USDC → accrues 5% APY visually ticking every second based on elapsed time since deposit (localStorage arcswap_stake). Withdraw returns principal + accrued display amount. Charts nothing, just clean numbers. Honest disclaimer line.

3. components/Analytics.tsx — Real market analytics page using CoinGecko endpoints already proven working:
   - USDC & EURC cards: price, 24h change, 7d sparkline, market cap, volume (endpoint /coins/{id}?localization=false&tickers=false&market_data=true)
   - Table: both stablecoins side by side with peg deviation from $1/$1.08
   - Refresh every 60s automatically
4. components/TxExplorer.tsx — Local tx explorer: unified searchable list of ALL user activity (swaps localStorage + bridges arcswap_bridges + limit fills + dca runs) with filters by type, date sort, CSV export button (Blob download), click → explorer link.

5. components/LearnHub.tsx — Static educational cards (What is Arc, What is CCTP, USDC vs EURC, Gas on Arc, Security tips) each expanding accordion-style with 2-3 paragraphs of accurate content you write. Clean typography focus.

6. components/GovernanceMock.tsx — SIMULATED governance: 3 sample proposals with vote for/against buttons, quorum bars animating to fixed percentages, one wallet = one vote stored locally. Clearly labeled simulation.

7. components/ReferralProgram.tsx — Upgrade existing ReferralCard into full page: big share link, copy/share buttons, fake-but-honest stats (visits tracked locally), how-it-works steps.

8. Header upgrade: global search input (filters tokens/chains/pages, opens dropdown results navigating via the same view-state mechanism).

## CHART UPGRADE (components/PriceChart.tsx rewrite)
- Timeframe tabs: 1H / 24H / 7D / 30D mapping to CoinGecko market_chart days=0.25? use days param: 1 for 24h, 7, 30 (1H uses same day-1 data sliced).
- Hover crosshair: vertical line + price bubble following mouse (pointer events on svg).
- Volume-ish area gradient fill stays. Price axis labels right side (3 ticks), time axis bottom (3 labels).
- Expand button → full-width overlay modal chart (bigger height 320px, close X).

## POLISH
- Every panel: consistent card style, skeleton loading states, empty states with helpful text.
- All localStorage keys prefixed arcswap_.
- Footer: add links that switch views (Analytics, Learn, Faucet).

## EXECUTION ORDER
Nav redesign FIRST (it hosts everything), then chart upgrade, then modules 1-8 in order. tsc clean after each. Final report: files created/modified.
