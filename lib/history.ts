"use client";

import { useEffect } from "react";

/**
 * Rolling portfolio value history persisted to localStorage.
 * Snapshots are recorded at most every 10 minutes, capped at 500 points.
 */

const STORAGE_KEY = "arcswap_portfolio_history";
const MIN_INTERVAL_MS = 10 * 60_000;
const MAX_POINTS = 500;

export type PortfolioPoint = { t: number; v: number };

export function loadPortfolioHistory(): PortfolioPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PortfolioPoint =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as PortfolioPoint).t === "number" &&
        typeof (p as PortfolioPoint).v === "number"
    );
  } catch {
    return [];
  }
}

/**
 * Append a snapshot if the last one is older than 10 minutes.
 * Returns true when a new point was stored.
 */
export function pushPortfolioSnapshot(value: number): boolean {
  if (typeof window === "undefined") return false;
  if (!Number.isFinite(value) || value <= 0) return false;
  const points = loadPortfolioHistory();
  const now = Date.now();
  const last = points[points.length - 1];
  if (last && now - last.t < MIN_INTERVAL_MS) return false;
  const next = [...points, { t: now, v: value }].slice(-MAX_POINTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  return true;
}

/** Record `value` whenever balances/prices update (rate-limited internally). */
export function useRecordPortfolio(value: number | null): void {
  useEffect(() => {
    if (value == null) return;
    pushPortfolioSnapshot(value);
  }, [value]);
}
