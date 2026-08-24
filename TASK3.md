# ArcSwap v3 — Full Feature Sprint (10 features)

You are upgrading /home/ubuntu/arc-dex (Next.js 15 + TS + Tailwind v4 + Circle App Kit). Read existing app/page.tsx, components/*, lib/* FIRST to match APIs exactly.

## HARD RULES
- No new npm packages. react/tailwind/viem/geist only.
- TypeScript strict — run `npx tsc --noEmit` after EACH task, fix before next.
- Keep white/black theme, Geist fonts, CSS vars.
- Do not break swap/bridge core in lib/appkit.ts / lib/bridge.ts / components/BridgePanel.tsx (it was just rebuilt with ChainPicker over 49 chains).
- Mobile-first. All new UI must work at 360px.

## EXISTING INFRA YOU MUST REUSE
- lib/bridge.ts: useBridge hook (doEstimate/doBridge), BRIDGE_CHAINS export kept for compat
- lib/bridgeChains.ts: 49 chains with groups
- lib/market.ts: CoinGecko prices (priceFor, useMarketPrices)
- lib/balances.ts: useBalances(address) -> {balances, loading, refetch}
- lib/toast.tsx: useToast() -> toast(msg, variant)
- lib/gas.ts: fee estimation
- components/: ChainPicker, SwapConfirmModal, Portfolio, PriceChart, RecentSwaps, TokenBadge(TokenDot), SettingsPopover, WalletButton, Toast, BridgePanel

## TASK 1 — Bridge Status Tracker (components/BridgeTracker.tsx)
- After a successful kit.bridge() call (BridgePanel onBridged already fires), show a live status card.
- CCTP V2 flow states: BURN_PENDING → ATTESTED → MINT_COMPLETE (or FAILED).
- Poll Circle's public attestation API every 5s: GET https://iris-api-sandbox.circle.com/v2/messages/{srcDomainId}?transactionHash={hash} — handle 404 as "pending". Map sourceTxHash/message fields; if API unreachable, fall back to elapsed-time based estimated progress (Burn ~1min → Attestation ~2-10min → Mint).
- Render: horizontal stepper (3 steps with connecting line), active step pulsing dot, completed steps checkmark ✓ green, current step spinner. Show tx hash link to the source chain explorer, elapsed timer mm:ss.
- On completion: toast "Bridge complete 🎉" and call balances refetch.
- Persist active bridge jobs to localStorage key arcswap_bridges so refresh keeps tracking. Max 3 shown.

## TASK 2 — Multi-chain USDC balances (components/MultiChainBalances.tsx + lib/multichain.ts)
- lib/multichain.ts: for each of these EVM testnet chains fetch native-arc-relevant USDC balance via viem createPublicClient + readContract balanceOf:
  Ethereum_Sepolia rpc https://ethereum-sepolia-rpc.publicnode.com usdc 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
  Base_Sepolia rpc https://base-sepolia-rpc.publicnode.com usdc 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  Avalanche_Fuji rpc https://avalanche-fuji-rpc.publicnode.com usdc 0x5425890298aed601595a70AB815c96711a31B651
  Arc_Testnet rpc https://rpc.testnet.arc.io usdc 0x3600000000000000000000000000000000000000 (6 dec)
- useMultichainUsdc(address): returns array {chainId label, balance number|null, loading} — fetch all in parallel, tolerate failures as null.
- Component renders compact list under Bridge tab header: logo USDC + chain name + balance right. Only render when wallet connected. Refresh button.
- Solana_Devnet etc non-EVM chains: skip silently (show "—" badge "non-EVM").

## TASK 3 — Limit orders (components/LimitOrderPanel.tsx + lib/limit.ts)
- New third tab "Limit" next to Swap/Bridge in page.tsx tabs.
- Form: pay token (USDC/EURC via TokenBadge select), receive token, amount, target rate input (prefilled from current market rate ±), expiry select (1h/24h/7d).
- lib/limit.ts: store orders in localStorage arcswap_limit_orders [{id, paySymbol, receiveSymbol, amount, targetRate, side, createdAt, expiresAt, status}]. 
- A polling effect (every 30s while any open order exists AND wallet connected): recompute current rate from lib/market.ts prices (EURC/USDC cross rate = priceEurc/priceUsdc); if rate crosses target → execute via getAppKit().swap same as page.tsx executeSwap flow (adapter from makeAdapter(provider)); mark order filled or failed; toast result.
- Panel lists open orders: pair, amount, target vs live rate (live colored green when favorable), countdown to expiry, cancel button. Filled/expired history below (last 10).

## TASK 4 — Price alerts (components/PriceAlerts.tsx + lib/alerts.ts)
- Bell icon button in header (next to settings). Opens small popover: list alerts + add form.
- Alert: token (USDC/EURC), direction above/below, price threshold. Stored localStorage arcswap_alerts.
- Check loop every 60s using lib/market.ts. When triggered: Notification API if granted (request permission on first alert creation), else in-app toast. Mark triggered, keep in list 1h then auto-remove.
- Badge count dot on bell when untriggered alerts exist.

## TASK 5 — Portfolio history chart (components/PortfolioChart.tsx)
- lib/history.ts: record portfolio total USD value snapshot every time balances/prices update AND >10min since last snapshot (localStorage arcswap_portfolio_history, cap 500 points {t, v}).
- Sparkline SVG (reuse PriceChart's svg approach) + min/max labels + % change since first point.
- Place inside Portfolio drawer expanded section.

## TASK 6 — Share receipt (components/ShareReceipt.tsx)
- After successful swap (page.tsx success path) render a Share button near the success state.
- Clicking opens small modal with a rendered receipt card (pure DOM, styled like existing cards): ArcSwap branding, pay→receive with logos+amounts, rate, tx hash short, timestamp, QR code drawn via tiny hand-rolled QR? NO — instead draw a simple canvas-based decorative pattern (do not implement real QR). Buttons: Copy text summary, Download PNG (html-to-canvas manually: draw receipt on <canvas> with fillText — simple black/white design, no libs), Close.
- Canvas PNG download must actually work (canvas.toBlob → a[download]).

## TASK 7 — Platform fee switch (lib/fees.ts + integrate)
- lib/fees.ts: constants FEE_BPS=10 (0.1%), FEE_RECIPIENT="0xd1d4354710d44889768410801c37544472515161".
- In SwapConfirmModal: line item "Platform fee (0.1%)" showing computed fee amount of pay token.
- In page.tsx swap config: pass customFee if App Kit SwapParams supports it (check index.d.ts for customFee/feeRecipient field names; if unsupported by types, omit execution wiring but KEEP the display line and a TODO comment). Never break the build over this.
- Toggle in SettingsPopover: "Enable platform fee" default ON, persisted arcswap_fee_enabled.

## TASK 8 — DCA bot (components/DcaPanel.tsx + lib/dca.ts)
- Fourth tab "DCA": form — pay token fixed USDC, receive token EURC, amount per run, interval (hourly/daily/weekly), start now checkbox.
- lib/dca.ts localStorage arcswap_dca_plans [{id, amount, intervalMs, receiveSymbol, nextRunAt, createdAt, runs[], status}].
- Polling effect every 60s: for each due plan (wallet connected) execute swap like limit order flow; log run results; reschedule. Pause/resume/delete buttons per plan. Runs history last 10.
- Clear disclaimer line: "Runs only while this tab is open."

## TASK 9 — PWA install (public/manifest.json + meta)
- public/manifest.json: name ArcSwap, short_name ArcSwap, start_url "/", display standalone, background #fafafa, theme #0a0a0a, icons: generate none — reuse an inline SVG data icon written to public/icon.svg (black rounded square, white A).
- app/layout.tsx metadata: manifest link, appleWebApp capable, viewport themeColor both schemes.
- Tiny InstallButton component that listens beforeinstallprompt, shows in header only when available; click triggers prompt.

## TASK 10 — Referral link (components/ReferralCard.tsx)
- Bottom of context column: "Invite & earn" collapsed card. Expand shows referral link https://arc-dex.samroise22.workers.dev/?ref=<first6-of-address>, copy button, count of visits stored locally (arcswap_ref_visits incremented when location.search has ref param), tiny stats line.
- On load, if ?ref present: toast "Invited by <ref>" once per session.

## FINAL
- Run npx tsc --noEmit until ZERO errors.
- Report files created/modified.
