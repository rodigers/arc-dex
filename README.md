# ArcSwap

A full-featured **DEX frontend for the Arc testnet**, built with Next.js (App Router) + Circle's App Kit / ArcSwap SDK, deployed to Cloudflare Workers via OpenNext.

Swap, bridge (CCTP), limit orders, DCA, multi-chain balances, price alerts, portfolio tracking, and referral rewards — wrapped in a clean black-and-white Geist-themed UI with liquid-glass surfaces.

---

## Features

| Area | What's included |
|------|-----------------|
| **Swap** | Token swap with live quotes, slippage presets, price-impact color coding, MAX button, insufficient-balance guard |
| **Bridge** | CCTP cross-chain transfer + live Bridge Status Tracker |
| **Limit Orders** | Place/cancel limit orders, order book view |
| **DCA** | Dollar-cost-averaging schedules |
| **Multi-chain Balances** | Aggregate USDC / EURC / native across chains |
| **Portfolio** | Holdings, allocation chart, recent activity |
| **Price Alerts** | Threshold alerts with notifications |
| **Referrals** | Referral card + on-chain fee wiring |
| **Wallet** | App Kit connect, network-status dot, wrong-network auto-switch |
| **Settings** | Custom slippage (0.01–50%), deadline, presets |
| **UX** | Toast system, skeleton shimmer, shareable receipts, recent-swaps history |

---

## Tech stack

- **Next.js 15** (App Router) + React 19 + Tailwind CSS v4
- **Circle App Kit / ArcSwap SDK** for swap/bridge/limit/DCA
- **viem** for contract reads (USDC `0x3600…0000`, EURC `0x89B5…D72a`, 6 decimals) + native balances via `publicClient.getBalance`
- **RPC:** `https://rpc.testnet.arc.io`
- **Deploy:** `opennextjs-cloudflare` → Cloudflare Workers

---

## Project structure

```
app/            routes, layout, global styles
components/     40+ UI components (Swap, Bridge, LimitOrder, DCA,
                Portfolio, WalletButton, TokenPicker, SettingsPopover, …)
lib/            hooks + clients: balances, bridge, limit, dca,
                alerts, fees, market, wallet, modal, toast
```

---

## Local development

```bash
cd arc-dex
npm install
npm run dev          # http://localhost:3000
```

---

## Build & deploy (Cloudflare)

```bash
NODE_OPTIONS=--max-old-space-size=1024 \
  npx opennextjs-cloudflare build
npx wrangler deploy
```

> The build is memory-constrained for small VPS instances — the
> `NODE_OPTIONS` cap keeps it under ~1 GB RAM.

`wrangler.json` points the worker at `.open-next/assets` (build output).

---

## Requirements

- Node.js 18+
- A Cloudflare account + `wrangler` OAuth (`npx wrangler login`)

---

## License

MIT
