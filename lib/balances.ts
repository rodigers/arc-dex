"use client";

import { useEffect, useState } from "react";
import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
} from "viem";

export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.io";

export const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;
export const EURC_ADDRESS =
  "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as const;

const ERC20_DECIMALS: Record<string, number> = {
  [USDC_ADDRESS.toLowerCase()]: 6,
  [EURC_ADDRESS.toLowerCase()]: 6,
};

let client: ReturnType<typeof createPublicClient> | null = null;

function getClient() {
  if (!client) {
    client = createPublicClient({ transport: http(ARC_TESTNET_RPC) });
  }
  return client;
}

export type Balances = Record<string, number>;

/**
 * Fetch ERC-20 + native balances for an address.
 * Returns a map keyed by token address (lowercased), plus "NATIVE".
 */
export function useBalances(address: string | null) {
  const [balances, setBalances] = useState<Balances>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setBalances({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const c = getClient();
        const [usdc, eurc, native] = await Promise.all([
          c.readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          }),
          c.readContract({
            address: EURC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          }),
          c.getBalance({ address: address as `0x${string}` }),
        ]);

        if (cancelled) return;

        setBalances({
          [USDC_ADDRESS.toLowerCase()]: Number(
            formatUnits(usdc, ERC20_DECIMALS[USDC_ADDRESS.toLowerCase()])
          ),
          [EURC_ADDRESS.toLowerCase()]: Number(
            formatUnits(eurc, ERC20_DECIMALS[EURC_ADDRESS.toLowerCase()])
          ),
          NATIVE: Number(formatUnits(native, 18)),
        });
      } catch {
        if (!cancelled) setBalances({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { balances, loading };
}
