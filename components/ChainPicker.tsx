"use client";

import { useMemo, useState } from "react";
import {
  BRIDGE_CHAINS,
  type BridgeChain,
} from "@/lib/bridgeChains";

/**
 * Searchable chain picker modal — replaces the old 4-chain <select>.
 * Groups: Mainnet / Testnet. Filter by name. Click to select.
 */
export function ChainPicker({
  value,
  onSelect,
  disabledIds = [],
  children,
}: {
  value: string;
  onSelect: (id: string) => void;
  disabledIds?: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<"All" | "Mainnet" | "Testnet">("All");

  const filtered = useMemo(() => {
    return BRIDGE_CHAINS.filter((c) => {
      if (group !== "All" && c.group !== group) return false;
      if (!query) return true;
      return (
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.id.toLowerCase().includes(query.toLowerCase())
      );
    });
  }, [query, group]);

  const selected: BridgeChain | undefined = BRIDGE_CHAINS.find(
    (c) => c.id === value
  );

  function pick(c: BridgeChain) {
    if (disabledIds.includes(c.id)) return;
    onSelect(c.id);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mono flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-xs outline-none transition-colors hover:border-[var(--muted)]"
      >
        {children}
        <span className="text-[10px] text-[var(--muted)]">▼</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card w-full max-w-sm rounded-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Select chain</span>
              <button
                onClick={() => setOpen(false)}
                className="cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <input
              autoFocus
              placeholder="Search chains…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mt-3 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)]"
            />

            {/* group tabs */}
            <div className="mt-2 flex gap-1">
              {(["All", "Mainnet", "Testnet"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    group === g
                      ? "bg-[var(--accent)] text-[var(--background)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto">
              {filtered.map((c) => {
                const isDisabled =
                  disabledIds.includes(c.id) || c.id === value;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => pick(c)}
                      disabled={isDisabled}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                        c.id === value
                          ? "bg-[var(--accent)] text-[var(--background)]"
                          : isDisabled
                            ? "opacity-30"
                            : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <span>{c.label}</span>
                      <span
                        className={`text-[9px] uppercase tracking-wide ${
                          c.id === value
                            ? "opacity-70"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {c.group}
                      </span>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-2 py-6 text-center text-xs text-[var(--muted)]">
                  No chains match “{query}”
                </li>
              )}
            </ul>

            <p className="mt-2 text-center text-[10px] text-[var(--muted)]">
              {BRIDGE_CHAINS.length} chains supported via CCTP
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export { bridgeChainLabel } from "@/lib/bridgeChains";
