"use client";

/**
 * App-level fee tiers + referral fee-share persistence.
 *
 * The displayed receive amount is adjusted by the selected tier so users see
 * an honest "net" estimate. The referral address (if set) is attached to
 * swaps for the fee-share program.
 */

export type FeeTier = {
  bps: number;
  label: string;
  desc: string;
};

export const FEE_TIERS: readonly FeeTier[] = [
  { bps: 5, label: "0.05%", desc: "Best for stable pairs" },
  { bps: 30, label: "0.3%", desc: "Standard" },
  { bps: 100, label: "1%", desc: "Exotic / volatile pairs" },
] as const;

const DEFAULT_TIER_BPS = 30;

const TIER_KEY = "arcswap_fee_tier";
const REFERRAL_KEY = "arcswap_referral_address";

export function loadFeeTierBps(): number {
  if (typeof window === "undefined") return DEFAULT_TIER_BPS;
  try {
    const raw = window.localStorage.getItem(TIER_KEY);
    const n = raw == null ? NaN : parseInt(raw, 10);
    if (FEE_TIERS.some((t) => t.bps === n)) return n;
  } catch {
    // storage unavailable — fall through to default
  }
  return DEFAULT_TIER_BPS;
}

export function saveFeeTierBps(bps: number): void {
  try {
    window.localStorage.setItem(TIER_KEY, String(bps));
  } catch {
    // ignore
  }
}

export function loadReferralAddress(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REFERRAL_KEY);
  } catch {
    return null;
  }
}

/** Persist a referral address, or clear it with null/empty input. */
export function saveReferralAddress(address: string | null): void {
  try {
    if (!address) window.localStorage.removeItem(REFERRAL_KEY);
    else window.localStorage.setItem(REFERRAL_KEY, address);
  } catch {
    // ignore
  }
}

/** Split `receiveAmount` into (fee, net) using basis points. */
export function applyAppFee(
  receiveAmount: number,
  bps: number
): { feeAmount: number; netReceive: number } {
  if (!Number.isFinite(receiveAmount) || receiveAmount <= 0) {
    return { feeAmount: 0, netReceive: receiveAmount };
  }
  const feeAmount = (receiveAmount * bps) / 10_000;
  return { feeAmount, netReceive: receiveAmount - feeAmount };
}
