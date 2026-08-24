"use client";

import { useState } from "react";
import type { EIP1193Provider } from "viem";
import {
  useWalletDiscovery,
  connectWallet,
  switchToArc,
  type EIP6963ProviderDetail,
} from "@/lib/wallet";

type WalletState = {
  provider: EIP1193Provider;
  address: string;
  walletName: string;
};

export function useWallet() {
  const wallets = useWalletDiscovery();
  const [state, setState] = useState<WalletState | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(detail: EIP6963ProviderDetail) {
    setConnecting(true);
    setError(null);
    try {
      const address = await connectWallet(detail.provider);
      if (!address) throw new Error("No account returned");
      await switchToArc(detail.provider);
      setState({
        provider: detail.provider,
        address,
        walletName: detail.info.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    setState(null);
  }

  return { wallets, state, connecting, error, connect, disconnect };
}
