"use client";

import { useEffect, useState } from "react";
import { ARC_EXPLORER } from "@/lib/tokens";

export type SwapRecord = {
  txHash: string;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  toAmount: string;
  timestamp: number;
};

const STORAGE_KEY = "arcswap_recent";
const MAX_SWAPS = 5;

export function loadRecentSwaps(): SwapRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_SWAPS) as SwapRecord[];
  } catch {
    return [];
  }
}

export function saveRecentSwap(record: SwapRecord) {
  if (typeof window === "undefined") return;
  const existing = loadRecentSwaps();
  const next = [record, ...existing].slice(0, MAX_SWAPS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RecentSwaps({ refreshKey }: { refreshKey?: number }) {
  const [swaps, setSwaps] = useState<SwapRecord[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSwaps(loadRecentSwaps());
  }, [refreshKey]);

  if (!mounted || swaps.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Recent swaps
      </div>
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        {swaps.map((s) => (
          <li
            key={`${s.txHash}-${s.timestamp}`}
            className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
          >
            <span className="mono truncate">
              {s.fromAmount} {s.fromSymbol} → {s.toAmount} {s.toSymbol}
            </span>
            <span className="flex shrink-0 items-center gap-3 text-xs text-[var(--muted)]">
              <span>{timeAgo(s.timestamp)}</span>
              <a
                href={`${ARC_EXPLORER}/tx/${s.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono underline-offset-2 hover:underline"
              >
                {shortHash(s.txHash)}
              </a>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
