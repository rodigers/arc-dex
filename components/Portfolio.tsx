"use client";

import { useEffect, useMemo, useState } from "react";
import type { TokenMeta } from "@/lib/tokens";
import { displaySymbolOf, TOKENS } from "@/lib/tokens";
import { tokenBalanceKey, type Balances } from "@/lib/balances";
import { priceFor, useMarketPrices } from "@/lib/market";
import { formatAmount, formatUsd } from "@/lib/format";

const HIDE_KEY = "arcswap_hide_balances";

type Row = {
  meta: TokenMeta;
  balance: number;
  usdValue: number | null;
  change24h: number | null;
  isGas?: boolean;
};

export function Portfolio({ balances }: { balances: Balances }) {
  const { prices } = useMarketPrices();
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setHidden(window.localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      // storage unavailable — default to visible
    }
  }, []);

  function toggleHidden() {
    setHidden((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(HIDE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const rows: Row[] = useMemo(() => {
    // USDC (ERC-20) and NATIVE gas are the same asset on Arc — merge them.
    const usdc = (balances[tokenBalanceKey("USDC")] ?? 0);
    const native = balances["NATIVE"] ?? 0;
    const mergedUsdc = usdc + native;

    return TOKENS.filter((t) => t.symbol !== "NATIVE").map((t) => {
      const balance =
        t.symbol === "USDC"
          ? mergedUsdc
          : (balances[tokenBalanceKey(t.symbol)] ?? 0);
      const market = priceFor(prices, t.symbol);
      return {
        meta: t,
        balance,
        usdValue: market ? balance * market.usd : null,
        change24h: market?.change24h ?? null,
        isGas: t.symbol === "USDC",
      };
    });
  }, [balances, prices]);

  const total = rows.reduce((acc, r) => acc + (r.usdValue ?? 0), 0);
  const anyPrice = rows.some((r) => r.usdValue != null);

  const mask = (node: React.ReactNode) =>
    hidden ? <span aria-label="hidden">••••</span> : node;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      {/* Collapsed header — click to expand (mobile-friendly drawer pattern) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <div>
          <div className="text-xs text-[var(--muted)]">Total value</div>
          <div className="mono mt-0.5 text-lg font-semibold">
            {anyPrice ? mask(formatUsd(total)) : "—"}
          </div>
        </div>
        <span
          className={`text-xs text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <>
      <div className="mt-1 flex items-center justify-end">
        <button
          type="button"
          onClick={toggleHidden}
          aria-label={hidden ? "Show amounts" : "Hide amounts"}
          aria-pressed={hidden}
          className="cursor-pointer rounded-lg border border-[var(--border)] p-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          {mounted && hidden ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      <ul className="mt-3 space-y-1">
        {rows.map((r) => (
          <li
            key={r.meta.symbol}
            className="flex items-center gap-3 rounded-xl px-1 py-1.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.meta.logo}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
              draggable={false}
            />
            <span className="min-w-0 flex-1">
              <span className="mono flex items-center gap-1.5 text-sm font-medium">
                {displaySymbolOf(r.meta)}
                {r.meta.subLabel && (
                  <span className="rounded-md border border-[var(--border)] px-1 py-px text-[9px] uppercase tracking-wide text-[var(--muted)]">
                    {r.meta.subLabel}
                  </span>
                )}
              </span>
              <span className="mono block text-xs text-[var(--muted)]">
                {mask(formatAmount(r.balance))}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="mono block text-sm">
                {r.usdValue != null ? mask(formatUsd(r.usdValue)) : "—"}
              </span>
              {r.change24h != null && !hidden && (
                <span
                  className="mono block text-xs"
                  style={{
                    color:
                      r.change24h >= 0
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {r.change24h >= 0 ? "+" : ""}
                  {r.change24h.toFixed(2)}%
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
        </>
      )}
    </section>
  );
}
