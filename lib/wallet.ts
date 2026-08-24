"use client";

import { useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";

export type EIP6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

export type EIP6963ProviderDetail = {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
};

/**
 * Discover EIP-6963 browser wallets.
 * Returns a live-updating list; call once at app start.
 */
export function useWalletDiscovery() {
  const [wallets, setWallets] = useState<EIP6963ProviderDetail[]>([]);

  useEffect(() => {
    const providers = new Map<string, EIP6963ProviderDetail>();

    const onAnnounce = (event: CustomEvent<EIP6963ProviderDetail>) => {
      providers.set(event.detail.info.uuid, event.detail);
      setWallets([...providers.values()]);
    };

    window.addEventListener(
      "eip6963:announceProvider",
      onAnnounce as EventListener
    );
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const t = window.setTimeout(() => setWallets([...providers.values()]), 300);
    return () => {
      window.removeEventListener(
        "eip6963:announceProvider",
        onAnnounce as EventListener
      );
      window.clearTimeout(t);
    };
  }, []);

  return wallets;
}

export async function connectWallet(provider: EIP1193Provider) {
  await provider.request({ method: "eth_requestAccounts", params: undefined });
  const accounts = (await provider.request({
    method: "eth_accounts",
    params: undefined,
  })) as string[];
  return accounts[0] ?? null;
}

const ARC_TESTNET = {
  chainId: "0x4cef52", // 5042002
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.io"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

export async function switchToArc(provider: EIP1193Provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_TESTNET.chainId }],
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 4902 || code === -32603) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [ARC_TESTNET],
      });
    } else {
      throw err;
    }
  }
}
