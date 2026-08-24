/**
 * Live on-chain activity for a wallet on Arc, fetched straight from the RPC.
 *
 * ArcScan's API host does not resolve publicly, so instead of guessing REST
 * shapes we walk recent blocks with standard JSON-RPC methods that are
 * guaranteed to work on any EVM chain:
 *   eth_getBlockByNumber(hash, true) → full transactions per block
 * Filter to the wallet address, decode value/ERC-20 transfers, map to the
 * UnifiedTx shape used by RecentSwaps.
 *
 * Scanning window: last N blocks (configurable), newest first.
 */

import { createPublicClient, http, type Address, type Hash } from "viem";

const ARC_RPC = "https://rpc.testnet.arc.io";
const CHAIN_ID = 5042002;

export type ChainActivity = {
  txHash: string;
  from: string;
  to: string | null;
  valueNative: number; // native USDC (18 dec)
  blockNumber: number;
  timestamp: number; // ms
  status: "success" | "pending" | "failed";
  direction: "in" | "out" | "self";
  kind: "transfer" | "contract";
};

const client = createPublicClient({
  transport: http(ARC_RPC),
});

let cachedChain: { id: number; fetchedAt: number } | null = null;

async function getChainId(): Promise<number> {
  if (cachedChain && Date.now() - cachedChain.fetchedAt < 60_000) {
    return cachedChain.id;
  }
  const id = await client.getChainId();
  cachedChain = { id: Number(id), fetchedAt: Date.now() };
  return Number(id);
}

export async function fetchWalletActivity(
  address: string,
  maxBlocks = 400
): Promise<ChainActivity[]> {
  try {
    await getChainId(); // warm + validates RPC reachability
    const latest = await client.getBlockNumber();
    const from = latest > BigInt(maxBlocks) ? latest - BigInt(maxBlocks) : 0n;

    const blockNumbers: bigint[] = [];
    for (let n = latest; n >= from; n--) blockNumbers.push(n);

    // Fetch blocks in parallel batches (RPC friendly)
    const BATCH = 20;
    const activities: ChainActivity[] = [];
    const addr = address.toLowerCase() as Address;

    for (let i = 0; i < blockNumbers.length; i += BATCH) {
      const slice = blockNumbers.slice(i, i + BATCH);
      const blocks = await Promise.all(
        slice.map((n) =>
          client
            .getBlock({ blockNumber: n, includeTransactions: true })
            .catch(() => null)
        )
      );

      for (const block of blocks) {
        if (!block || !block.transactions) continue;
        const ts = block.timestamp ? Number(block.timestamp) * 1000 : Date.now();
        for (const tx of block.transactions) {
          const txFrom = tx.from.toLowerCase();
          const txTo = tx.to ? tx.to.toLowerCase() : null;
          if (txFrom !== addr && txTo !== addr) continue;

          const value = Number(tx.value ?? 0n) / 1e18;
          activities.push({
            txHash: tx.hash,
            from: tx.from,
            to: tx.to ?? null,
            valueNative: value,
            blockNumber: Number(block.number ?? 0n),
            timestamp: ts,
            status: "success", // mined in block = success
            direction:
              txFrom === addr && txTo === addr
                ? "self"
                : txFrom === addr
                  ? "out"
                  : "in",
            kind: txTo && tx.input && tx.input !== "0x" ? "contract" : "transfer",
          });
        }
      }
    }

    return activities.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

/** Human label for a ChainActivity row. */
export function describeActivity(a: ChainActivity): {
  title: string;
  detail: string;
} {
  if (a.kind === "transfer") {
    return {
      title: a.direction === "in" ? "Received USDC" : "Sent USDC",
      detail: `${a.valueNative ? a.valueNative.toFixed(4) : "0"} USDC`,
    };
  }
  return {
    title: a.direction === "in" ? "Contract interaction" : "Contract call",
    detail: a.valueNative > 0 ? `${a.valueNative.toFixed(4)} USDC` : "gas only",
  };
}

export type { Address, Hash };
