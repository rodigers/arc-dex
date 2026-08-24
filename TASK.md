# ArcSwap UI Rebuild — Task Brief

You are rebuilding the frontend of a Next.js 15 App Router DEX app located at /home/ubuntu/arc-dex.

## Stack (do not change)
- Next.js 15+, TypeScript, Tailwind CSS v4, Geist fonts (already in layout.tsx)
- Circle App Kit (@circle-fin/app-kit) for swap/bridge — DO NOT touch lib/appkit.ts logic
- Wallet: lib/wallet.ts + lib/useWallet.ts (EIP-6963) — do not break

## CRITICAL BUGS to fix first
1. app/globals.css: the `.grid-bg` mask-image makes ALL content below the fold invisible on mobile. Remove the mask-image entirely or scope it to a decorative ::before pseudo-element only. This is the #1 bug.
2. Chain ID must be read from the connected wallet's provider (eth_chainId), not hardcoded. Display it in the UI from live state.
3. Token balances must be shown per token (USDC ERC-20 at 0x3600000000000000000000000000000000000000, 6 decimals; EURC at 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a, 6 decimals; native gas USDC 18 decimals via provider.getBalance). Read them with viem createPublicClient against RPC https://rpc.testnet.arc.io when wallet connects; refetch after every successful swap.

## Features to add (production-ready DEX standard)
- Balance row inside each token input box: show user balance for selected token, right-aligned, small text. Add a "MAX" button that fills the amount input.
- Insufficient balance state: if amount > balance, disable swap button and show red warning text "Insufficient X balance" with a link to https://faucet.circle.com
- Toast notification system (simple custom implementation, no library): success/error toasts top-right, auto-dismiss 5s, used for tx sent / tx error / wallet connected
- Skeleton loading shimmer for the receive amount while quoting
- Settings popover: custom slippage input (0.01%-50% validation) alongside presets, transaction deadline minutes (default 10)
- Recent transactions list section below swap card: store last 5 swaps in localStorage {hash, tokenIn, tokenOut, amountIn, timestamp}, render with explorer links (https://testnet.arcscan.app/tx/{hash}), clear-all button
- Network status indicator dot in header: green = connected to chain 5042002, red = wrong network with "Switch to Arc" button that calls switchToArc
- Price impact display: estimate.fees if available, otherwise compute price impact from rate vs 1.0 baseline, color coded (green <1%, yellow <3%, red >3%)

## Design system (keep this identity)
- White/black minimal theme, light default, dark-mode via prefers-color-scheme using existing CSS vars
- Geist Sans for UI, Geist Mono (.mono class) for numbers/addresses
- Cards: rounded-2xl, 1px var(--border), subtle shadow, NO gradients, NO purple/blue
- Accent color: pure black (white in dark mode)
- Mobile-first: max-w-md centered column; test all spacing at 360px width
- Micro-interactions: hover states everywhere, active:scale-[0.98] on buttons, transition-transform on flip button

## Constraints
- Do NOT add any npm packages except none — everything with what exists (react, tailwind, viem)
- Do NOT modify package.json dependencies
- Keep TypeScript strict — no `any` unless unavoidable with eslint-disable comment
- All client components need "use client"
- After changes, run: npx tsc --noEmit — must pass with zero errors. Do not run next build or deploy.

## Deliverables
Rewrite: app/page.tsx, app/globals.css, components/WalletButton.tsx, components/TokenBadge.tsx
Create: components/Toast.tsx (+ context/provider), components/SettingsPopover.tsx, components/RecentSwaps.tsx, lib/balances.ts (viem balance reading hooks), lib/toast.tsx
Update: app/layout.tsx only if needed for toast provider wrapping.

Work file by file. Verify types compile after each major file.
