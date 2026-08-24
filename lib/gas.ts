"use client";

import { createPublicClient, http } from "viem";
import { ARC_TESTNET_RPC } from "@/lib/balances";

const DUMMY_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const NATIVE_DECIMALS = 18;
const CACHE_MS = 60_000;

let cache: { at: number; promise: Promise<number | null> } | null = null;

/**
 * Estimate a network fee in USDC (the native gas token, 18 decimals):
 * gas units for a dummy native transfer × current gas price.
 * Returns null when estimation fails.
 */
async function estimate(): Promise<number | null> {
  try {
    const client = createPublicClient({ transport: http(ARC_TESTNET_RPC) });
    const [gasUnits, gasPrice] = await Promise.all([
      client.estimateGas({
        account: DUMMY_ADDRESS,
        to: DUMMY_ADDRESS,
        value: BigInt(0),
      }),
      client.getGasPrice(),
    ]);
    const feeHuman =
      (Number(gasUnits) * Number(gasPrice)) / 10 ** NATIVE_DECIMALS;
    return Number.isFinite(feeHuman) && feeHuman >= 0 ? feeHuman : null;
  } catch {
    return null;
  }
}

/** Cached (60s) network fee estimate in human USDC units, or null. */
export function estimateNetworkFeeUsd(): Promise<number | null> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const promise = estimate();
    cache = { at: Date.now(), promise };
    // Don't pin failures for the whole window — retry sooner.
    promise.then((result) => {
      if (result == null && cache && cache.promise === promise) cache = null;
    });
  }
  return cache.promise;
}

export function formatFeeUsd(fee: number | null): string {
  if (fee == null || !Number.isFinite(fee) || fee <= 0) return "≈ <0.01 USDC";
  if (fee < 0.01) return "≈ <0.01 USDC";
  return `≈ ${fee.toFixed(fee < 1 ? 4 : 2)} USDC`;
}
