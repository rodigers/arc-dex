"use client";

import { useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";
import { getAppKit, makeAdapter } from "@/lib/appkit";

type AdapterFor = Awaited<ReturnType<typeof makeAdapter>>;

export const BRIDGE_CHAINS = [
  { id: "Ethereum_Sepolia", label: "Ethereum Sepolia" },
  { id: "Base_Sepolia", label: "Base Sepolia" },
  { id: "Avalanche_Fuji", label: "Avalanche Fuji" },
  { id: "Arc_Testnet", label: "Arc Testnet" },
] as const;

export type BridgeChainId = (typeof BRIDGE_CHAINS)[number]["id"];

type BridgeEstimate = {
  estimatedOutput?: { amount?: string };
  fees?: unknown;
  [k: string]: unknown;
};

type BridgeResult = {
  txHash?: string;
  transactionHash?: string;
  [k: string]: unknown;
};

/**
 * Cross-chain USDC bridge via Circle App Kit (CCTP).
 * Same adapter/wallet as swap; only chain pair differs.
 */
export function useBridge() {
  const [estimating, setEstimating] = useState(false);
  const [bridging, setBridging] = useState(false);
  const [estimate, setEstimate] = useState<BridgeEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doEstimate(
    adapterPromise: Promise<AdapterFor>,
    fromChain: string,
    toChain: string,
    amount: string
  ) {
    setEstimating(true);
    setError(null);
    try {
      const adapter = await adapterPromise;
      const est = (await getAppKit().estimateBridge({
        from: { adapter, chain: fromChain },
        to: { adapter, chain: toChain },
        amount,
        token: "USDC",
      } as never)) as unknown as BridgeEstimate;
      setEstimate(est);
    } catch (err) {
      setEstimate(null);
      setError(err instanceof Error ? err.message : "Bridge estimate failed");
    } finally {
      setEstimating(false);
    }
  }

  async function doBridge(
    adapterPromise: Promise<AdapterFor>,
    fromChain: string,
    toChain: string,
    amount: string
  ): Promise<{ ok: boolean; hash: string }> {
    setBridging(true);
    setError(null);
    try {
      const adapter = await adapterPromise;
      const result = (await getAppKit().bridge({
        from: { adapter, chain: fromChain },
        to: { adapter, chain: toChain },
        amount,
        token: "USDC",
      } as never)) as unknown as BridgeResult;
      return {
        ok: true,
        hash: result?.txHash ?? result?.transactionHash ?? "",
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bridge failed");
      return { ok: false, hash: "" };
    } finally {
      setBridging(false);
    }
  }

  return { estimating, bridging, estimate, error, doEstimate, doBridge };
}

/** Re-export so the page can type its adapter cache once for both flows. */
export type { AdapterFor, EIP1193Provider };

export function chainLabel(id: string) {
  return BRIDGE_CHAINS.find((c) => c.id === id)?.label ?? id;
}

export function useDebouncedEffect(
  fn: () => void,
  deps: unknown[],
  ms: number
) {
  useEffect(() => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
