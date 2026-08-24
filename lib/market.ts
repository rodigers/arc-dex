"use client";

import { useCallback, useEffect, useState } from "react";
import type { TokenSymbol } from "@/lib/tokens";

/** CoinGecko ids for tokens we display (NATIVE gas token is USDC). */
export const COINGECKO_IDS: Partial<Record<TokenSymbol, string>> = {
  USDC: "usd-coin",
  EURC: "euro-coin",
  NATIVE: "usd-coin",
};

export type MarketPrice = {
  usd: number;
  change24h: number | null;
};

export type PricePoint = [timestampMs: number, priceUsd: number];

const SIMPLE_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,euro-coin&vs_currencies=usd&include_24hr_change=true";

const PRICE_CACHE_MS = 60_000;

let priceCache: {
  at: number;
  data: Promise<Record<string, MarketPrice> | null>;
} | null = null;

function inFlightPrices(): Promise<Record<string, MarketPrice> | null> {
  if (priceCache && Date.now() - priceCache.at < PRICE_CACHE_MS) {
    return priceCache.data;
  }
  const data = fetchPrices();
  priceCache = { at: Date.now(), data };
  // Do not cache failures for the full window — retry sooner.
  data.then((result) => {
    if (!result && priceCache && priceCache.data === data) priceCache = null;
  });
  return data;
}

/**
 * Fetch 24h prices + change from CoinGecko's free API.
 * Returns null on any failure — callers must degrade gracefully.
 */
export async function fetchPrices(): Promise<
  Record<string, MarketPrice> | null
> {
  try {
    const res = await fetch(SIMPLE_PRICE_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (typeof json !== "object" || json === null) return null;
    const raw = json as Record<
      string,
      { usd?: unknown; usd_24h_change?: unknown }
    >;
    const out: Record<string, MarketPrice> = {};
    for (const [id, entry] of Object.entries(raw)) {
      if (typeof entry?.usd !== "number") continue;
      out[id] = {
        usd: entry.usd,
        change24h:
          typeof entry.usd_24h_change === "number"
            ? entry.usd_24h_change
            : null,
      };
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Fetch ~24h of hourly price points for one CoinGecko id. Null on failure. */
export async function fetchSparkline(id: string): Promise<PricePoint[] | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
        id
      )}/market_chart?vs_currency=usd&days=1`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (typeof json !== "object" || json === null) return null;
    const raw = (json as { prices?: unknown }).prices;
    if (!Array.isArray(raw)) return null;
    const points: PricePoint[] = [];
    for (const pair of raw) {
      if (
        Array.isArray(pair) &&
        typeof pair[0] === "number" &&
        typeof pair[1] === "number"
      ) {
        points.push([pair[0], pair[1]]);
      }
    }
    return points.length >= 2 ? points : null;
  } catch {
    return null;
  }
}

/** Look up the market price for a UI token symbol, or null when unavailable. */
export function priceFor(
  prices: Record<string, MarketPrice> | null,
  symbol: TokenSymbol
): MarketPrice | null {
  if (!prices) return null;
  const id = COINGECKO_IDS[symbol];
  if (!id) return null;
  return prices[id] ?? null;
}

/** Shared, cached market prices for all listed tokens. */
export function useMarketPrices() {
  const [prices, setPrices] = useState<Record<string, MarketPrice> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    inFlightPrices().then((data) => {
      if (cancelled) return;
      setPrices(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const refetch = useCallback(() => {
    priceCache = null;
    setNonce((n) => n + 1);
  }, []);

  return { prices, loading, refetch };
}
