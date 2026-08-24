"use client";

import { useEffect, useState } from "react";
import { ARC_EXPLORER, tokenMeta } from "@/lib/tokens";
import { formatAmount, shortHash, timeAgo } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

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
const ARCSCAN_API = "https://api.arcscan.app/v1";
const CHAIN_FETCH_TIMEOUT_MS = 5000;

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

type TxStatus = "success" | "pending" | "failed";

type UnifiedTx = SwapRecord & {
  key: string;
  status: TxStatus;
  source: "local" | "chain";
};

function toUnified(record: SwapRecord): UnifiedTx {
  return {
    ...record,
    key: `${record.txHash}-${record.timestamp}`,
    status: "success",
    source: "local",
  };
}

/**
 * Best-effort parse of ArcScan address transactions. The API shape is not
 * guaranteed, so every field is probed defensively; unparseable rows are
 * skipped rather than crashing the list.
 */
function parseArcScanTransactions(json: unknown): UnifiedTx[] {
  let list: unknown[] = [];
  if (Array.isArray(json)) {
    list = json;
  } else if (typeof json === "object" && json !== null) {
    const nested = (
      json as {
        transactions?: unknown;
        items?: unknown;
        result?: unknown;
      }
    );
    for (const candidate of [nested.transactions, nested.items, nested.result]) {
      if (Array.isArray(candidate)) {
        list = candidate;
        break;
      }
    }
  }

  const out: UnifiedTx[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const tx = entry as Record<string, unknown>;
    const hash =
      typeof tx.hash === "string"
        ? tx.hash
        : typeof tx.txHash === "string"
          ? tx.txHash
          : typeof tx.transactionHash === "string"
            ? tx.transactionHash
            : null;
    if (!hash) continue;

    const rawTs = tx.timeStamp ?? tx.timestamp ?? tx.time;
    let timestamp = Date.now();
    if (typeof rawTs === "number" && Number.isFinite(rawTs)) {
      timestamp = rawTs > 1e12 ? rawTs : rawTs * 1000;
    }

    const statusRaw = String(tx.status ?? "").toLowerCase();
    let status: TxStatus = "pending";
    if (/fail|revert|drop/.test(statusRaw)) status = "failed";
    else if (/ok|success|true|1|finali|execut|mined/.test(statusRaw))
      status = "success";

    const value = typeof tx.value === "number" ? tx.value : null;

    out.push({
      key: `chain-${hash}-${timestamp}`,
      txHash: hash,
      fromSymbol: "NATIVE",
      toSymbol: "NATIVE",
      fromAmount: value != null ? formatAmount(value / 1e18) : "",
      toAmount: "",
      timestamp,
      status,
      source: "chain",
    });
  }
  return out;
}

async function fetchChainTransactions(
  address: string
): Promise<UnifiedTx[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      CHAIN_FETCH_TIMEOUT_MS
    );
    const res = await fetch(
      `${ARCSCAN_API}/addresses/${encodeURIComponent(
        address
      )}/transactions?limit=10`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const json: unknown = await res.json();
    return parseArcScanTransactions(json);
  } catch {
    return [];
  }
}

function StatusDot({ status }: { status: TxStatus }) {
  const color =
    status === "success"
      ? "var(--success)"
      : status === "pending"
        ? "var(--warning)"
        : "var(--danger)";
  return (
    <span
      aria-label={status}
      title={status}
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

function TokenLogo({ symbol }: { symbol: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tokenMeta(symbol).logo}
      alt=""
      className="h-5 w-5 shrink-0 rounded-full border border-[var(--border)] object-cover"
      draggable={false}
    />
  );
}

export function RecentSwaps({
  refreshKey,
  address,
}: {
  refreshKey?: number;
  address?: string | null;
}) {
  const [swaps, setSwaps] = useState<UnifiedTx[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const local = loadRecentSwaps().map(toUnified);

    let cancelled = false;
    if (!address) {
      setSwaps(local);
      return;
    }

    fetchChainTransactions(address).then((chainTxs) => {
      if (cancelled) return;
      // Local records win over chain rows with the same hash.
      const seen = new Set(local.map((tx) => tx.txHash));
      const merged = [
        ...local,
        ...chainTxs.filter((tx) => !seen.has(tx.txHash)),
      ].sort((a, b) => b.timestamp - a.timestamp);
      setSwaps(merged.slice(0, 15));
    });

    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  if (!mounted) return null;

  if (swaps.length === 0) {
    return (
      <section className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Recent activity
        </div>
        <div className="card-surface rounded-2xl">
          <EmptyState
            icon={
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7h13m0 0-3-3m3 3-3 3" />
                <path d="M20 17H7m0 0 3-3m-3 3 3 3" />
              </svg>
            }
          >
            No swaps yet. Your recent swaps will appear here.
          </EmptyState>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Recent activity
      </div>
      <ul className="card-surface divide-y divide-[var(--border)] overflow-hidden rounded-2xl">
        {swaps.map((s) => (
          <li
            key={s.key}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm"
          >
            <span className="flex shrink-0 items-center">
              <TokenLogo symbol={s.fromSymbol} />
              {s.toSymbol !== s.fromSymbol && (
                <span className="-ml-1.5">
                  <TokenLogo symbol={s.toSymbol} />
                </span>
              )}
            </span>
            <span className="mono min-w-0 flex-1 truncate">
              {s.toAmount
                ? `${formatAmount(Number(s.fromAmount))} ${tokenMeta(s.fromSymbol).displaySymbol} → ${formatAmount(Number(s.toAmount))} ${tokenMeta(s.toSymbol).displaySymbol}`
                : s.source === "chain"
                  ? "Transaction"
                  : `${s.fromAmount} ${s.fromSymbol} → ${s.toAmount} ${s.toSymbol}`}
            </span>
            <span className="flex shrink-0 items-center gap-3 text-xs text-[var(--muted)]">
              <StatusDot status={s.status} />
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
