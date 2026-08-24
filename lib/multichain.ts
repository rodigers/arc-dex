"use client";

import { useCallback, useEffect, useState } from "react";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";

/**
 * Multi-chain USDC balances for the EVM testnet chains reachable from the
 * bridge UI. Non-EVM chains (e.g. Solana_Devnet) are listed but skipped.
 */

export type MultichainEntry = {
  id: string;
  label: string;
  /** false → non-EVM chain, skipped silently (shown as "—" / non-EVM). */
  evm: boolean;
  rpc: string | null;
  usdc: string | null;
  decimals: number;
};

export const MULTICHAIN_USDC: MultichainEntry[] = [
  {
    id: "Ethereum_Sepolia",
    label: "Ethereum Sepolia",
    evm: true,
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    decimals: 6,
  },
  {
    id: "Base_Sepolia",
    label: "Base Sepolia",
    evm: true,
    rpc: "https://base-sepolia-rpc.publicnode.com",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
  },
  {
    id: "Avalanche_Fuji",
    label: "Avalanche Fuji",
    evm: true,
    rpc: "https://avalanche-fuji-rpc.publicnode.com",
    usdc: "0x5425890298aed601595a70AB815c96711a31B651",
    decimals: 6,
  },
  {
    id: "Arc_Testnet",
    label: "Arc Testnet",
    evm: true,
    rpc: "https://rpc.testnet.arc.io",
    usdc: "0x3600000000000000000000000000000000000000",
    decimals: 6,
  },
  {
    id: "Solana_Devnet",
    label: "Solana Devnet",
    evm: false,
    rpc: null,
    usdc: null,
    decimals: 6,
  },
];

export type MultichainBalance = {
  id: string;
  label: string;
  evm: boolean;
  balance: number | null;
  loading: boolean;
};

const clients = new Map<string, ReturnType<typeof createPublicClient>>();

function clientFor(rpc: string) {
  let c = clients.get(rpc);
  if (!c) {
    c = createPublicClient({ transport: http(rpc) });
    clients.set(rpc, c);
  }
  return c;
}

async function fetchUsdcBalance(
  entry: MultichainEntry,
  address: string
): Promise<number | null> {
  if (!entry.evm || !entry.rpc || !entry.usdc) return null;
  try {
    const raw = await clientFor(entry.rpc).readContract({
      address: entry.usdc as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    const value = Number(formatUnits(raw, entry.decimals));
    return Number.isFinite(value) ? value : null;
  } catch {
    // Tolerate any per-chain failure (rate limit, RPC down, …) as null.
    return null;
  }
}

/** Fetch USDC balances on all supported EVM testnets, in parallel. */
export function useMultichainUsdc(address: string | null): {
  rows: MultichainBalance[];
  refetch: () => void;
} {
  const [rows, setRows] = useState<MultichainBalance[]>(() =>
    MULTICHAIN_USDC.map((c) => ({
      id: c.id,
      label: c.label,
      evm: c.evm,
      balance: null,
      loading: false,
    }))
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!address) {
      setRows((prev) =>
        prev.map((r) => ({ ...r, balance: null, loading: false }))
      );
      return;
    }

    let cancelled = false;
    setRows((prev) =>
      prev.map((r) => ({ ...r, loading: r.evm, balance: r.evm ? null : r.balance }))
    );

    void Promise.all(
      MULTICHAIN_USDC.filter((c) => c.evm).map(async (entry) => {
        const balance = await fetchUsdcBalance(entry, address);
        return { id: entry.id, balance };
      })
    ).then((results) => {
      if (cancelled) return;
      const byId = new Map(results.map((r) => [r.id, r.balance]));
      setRows((prev) =>
        prev.map((r) =>
          byId.has(r.id)
            ? { ...r, balance: byId.get(r.id) ?? null, loading: false }
            : r
        )
      );
    });

    return () => {
      cancelled = true;
    };
  }, [address, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { rows, refetch };
}
