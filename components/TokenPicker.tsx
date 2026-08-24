"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TokenSymbol } from "@/lib/tokens";
import { displaySymbolOf, TOKENS } from "@/lib/tokens";
import { tokenBalanceKey, type Balances } from "@/lib/balances";

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000)
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 1)
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function TokenPicker({
  open,
  onClose,
  onSelect,
  balances,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (s: TokenSymbol) => void;
  balances?: Balances;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOKENS;
    return TOKENS.filter(
      (t) =>
        displaySymbolOf(t).toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
    );
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="animate-pop-in fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Select a token"
      onClick={onClose}
    >
      <div
        className="animate-pop-in flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold">Select a token</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-sm leading-none text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </div>

        <div className="px-4 pt-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or symbol…"
            className="mono w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
            aria-label="Search tokens"
          />
        </div>

        <ul className="mt-3 flex-1 overflow-y-auto pb-2">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-[var(--muted)]">
              No tokens match “{query}”.
            </li>
          )}
          {results.map((t) => {
            const balance = balances?.[tokenBalanceKey(t.symbol)] ?? null;
            return (
              <li key={t.symbol}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(t.symbol);
                    onClose();
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.logo}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                    draggable={false}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="mono flex items-center gap-1.5 text-sm font-semibold">
                      {displaySymbolOf(t)}
                      {t.subLabel && (
                        <span
                          className="rounded-md border border-[var(--border)] px-1 py-px text-[9px] font-normal uppercase tracking-wide text-[var(--muted)]"
                          title={`${t.subLabel} — used for network fees`}
                        >
                          {t.subLabel}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {t.name}
                    </span>
                  </span>
                  <span className="mono shrink-0 text-sm text-right">
                    {balance != null ? formatAmount(balance) : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
