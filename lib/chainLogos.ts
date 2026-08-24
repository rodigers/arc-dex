/**
 * Chain logo mapping — real logos downloaded to /public/chains/*.webp.
 * Chains without a fetched logo fall back to a generated letter avatar.
 */

export type ChainLogoInfo = {
  /** public path to the logo image, or null if unavailable */
  logo: string | null;
  label: string;
};

const CHAIN_LOGOS: Record<string, string> = {
  Ethereum: "/chains/ethereum.webp",
  "Ethereum Sepolia": "/chains/ethereum.webp",
  Base: "/chains/base.webp",
  "Base Sepolia": "/chains/base.webp",
  Arbitrum: "/chains/arbitrum.webp",
  "Arbitrum Sepolia": "/chains/arbitrum.webp",
  Optimism: "/chains/optimism.webp",
  "Optimism Sepolia": "/chains/optimism.webp",
  Polygon: "/chains/polygon.webp",
  "Polygon Amoy": "/chains/polygon.webp",
  Avalanche: "/chains/avalanche.webp",
  "Avalanche Fuji": "/chains/avalanche.webp",
  Solana: "/chains/solana.webp",
  "Solana Devnet": "/chains/solana.webp",
  Linea: "/chains/linea.webp",
  "Linea Sepolia": "/chains/linea.webp",
  Sonic: "/chains/sonic.webp",
  "Sonic Testnet": "/chains/sonic.webp",
  Unichain: "/chains/unichain.webp",
  "Unichain Sepolia": "/chains/unichain.webp",
  Ink: "/chains/ink.webp",
  "Ink Testnet": "/chains/ink.webp",
  Morph: "/chains/morph.webp",
  "Morph Testnet": "/chains/morph.webp",
  Plume: "/chains/plume.webp",
  "Plume Testnet": "/chains/plume.webp",
  Monad: "/chains/monad.webp",
  "Monad Testnet": "/chains/monad.webp",
  Sei: "/chains/sei.webp",
  "Sei Testnet": "/chains/sei.webp",
  Injective: "/chains/injective.webp",
  "Injective Testnet": "/chains/injective.webp",
  Cronos: "/chains/cronos.webp",
  "Cronos Testnet": "/chains/cronos.webp",
  HyperEVM: "/chains/hyperliquid.webp",
  "HyperEVM Testnet": "/chains/hyperliquid.webp",
  XDC: "/chains/xdc.webp",
  "XDC Apothem": "/chains/xdc.webp",
  Codex: "/chains/codex.webp",
  "Codex Testnet": "/chains/codex.webp",
  Pharos: "/chains/pharos.webp",
  "Pharos Testnet": "/chains/pharos.webp",
};

export function chainLogo(chainLabel: string): ChainLogoInfo {
  return {
    logo: CHAIN_LOGOS[chainLabel] ?? null,
    label: chainLabel,
  };
}

/** Deterministic pastel color from a string (for letter avatars). */
export function chainColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 45% 45%)`;
}
