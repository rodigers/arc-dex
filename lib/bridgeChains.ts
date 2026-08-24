"use client";

// Full chain list from @circle-fin/app-kit BridgeChain enum (49 chains).
// Grouped for a searchable picker UI.

export type BridgeChain = {
  id: string;
  label: string;
  group: "Mainnet" | "Testnet";
};

const MAINNET: [string, string][] = [
  ["Arbitrum", "Arbitrum"],
  ["Avalanche", "Avalanche"],
  ["Base", "Base"],
  ["Codex", "Codex"],
  ["Cronos", "Cronos"],
  ["Edge", "Edge"],
  ["Ethereum", "Ethereum"],
  ["HyperEVM", "HyperEVM"],
  ["Injective", "Injective"],
  ["Ink", "Ink"],
  ["Linea", "Linea"],
  ["Monad", "Monad"],
  ["Morph", "Morph"],
  ["Optimism", "Optimism"],
  ["Pharos", "Pharos"],
  ["Plume", "Plume"],
  ["Polygon", "Polygon"],
  ["Sei", "Sei"],
  ["Solana", "Solana"],
  ["Sonic", "Sonic"],
  ["Unichain", "Unichain"],
  ["World_Chain", "World Chain"],
  ["XDC", "XDC"],
  ["X_Layer", "X Layer"],
];

const TESTNET: [string, string][] = [
  ["Arc_Testnet", "Arc Testnet"],
  ["Arbitrum_Sepolia", "Arbitrum Sepolia"],
  ["Avalanche_Fuji", "Avalanche Fuji"],
  ["Base_Sepolia", "Base Sepolia"],
  ["Codex_Testnet", "Codex Testnet"],
  ["Cronos_Testnet", "Cronos Testnet"],
  ["Edge_Testnet", "Edge Testnet"],
  ["Ethereum_Sepolia", "Ethereum Sepolia"],
  ["HyperEVM_Testnet", "HyperEVM Testnet"],
  ["Injective_Testnet", "Injective Testnet"],
  ["Ink_Testnet", "Ink Testnet"],
  ["Linea_Sepolia", "Linea Sepolia"],
  ["Monad_Testnet", "Monad Testnet"],
  ["Morph_Testnet", "Morph Testnet"],
  ["Optimism_Sepolia", "Optimism Sepolia"],
  ["Pharos_Testnet", "Pharos Testnet"],
  ["Plume_Testnet", "Plume Testnet"],
  ["Polygon_Amoy_Testnet", "Polygon Amoy"],
  ["Sei_Testnet", "Sei Testnet"],
  ["Solana_Devnet", "Solana Devnet"],
  ["Sonic_Testnet", "Sonic Testnet"],
  ["Unichain_Sepolia", "Unichain Sepolia"],
  ["World_Chain_Sepolia", "World Chain Sepolia"],
  ["XDC_Apothem", "XDC Apothem"],
  ["X_Layer_Testnet", "X Layer Testnet"],
];

export const BRIDGE_CHAINS: BridgeChain[] = [
  ...MAINNET.map(([id, label]) => ({ id, label, group: "Mainnet" as const })),
  ...TESTNET.map(([id, label]) => ({ id, label, group: "Testnet" as const })),
];

export function bridgeChainLabel(id: string) {
  return BRIDGE_CHAINS.find((c) => c.id === id)?.label ?? id;
}
