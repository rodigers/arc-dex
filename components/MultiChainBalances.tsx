"use client";

import { TokenDot } from "@/components/TokenBadge";
import { useMultichainUsdc } from "@/lib/multichain";
import { formatAmount } from "@/lib/format";

/**
 * Compact multi-chain USDC balance list shown under the Bridge tab header.
 * Non-EVM chains render as "—" with a "non-EVM" badge (skipped silently).
 */
export function MultiChainBalances({ address }: { address: string | null }) {
  const { rows, refetch } = useMultichainUsdc(address);

  if (!address) return null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted)]">
          USDC across chains
        </span>
        <button
          type="button"
          onClick={refetch}
          aria-label="Refresh multi-chain balances"
          className="cursor-pointer rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
        >
          ↻ Refresh
        </button>
      </div>

      <ul className="mt-2 divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2.5 py-2 text-sm">
            <TokenDot symbol="USDC" />
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            {r.evm ? (
              <span className="mono shrink-0 tabular-nums">
                {r.loading ? (
                  <span className="skeleton inline-block h-3.5 w-14 rounded" />
                ) : r.balance != null ? (
                  formatAmount(r.balance)
                ) : (
                  <span className="text-[var(--muted)]">—</span>
                )}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-[var(--muted)]">—</span>
                <span className="rounded-md border border-[var(--border)] px-1 py-px text-[9px] uppercase tracking-wide text-[var(--muted)]">
                  non-EVM
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
