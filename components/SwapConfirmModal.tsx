"use client";

import { useEffect, useState } from "react";
import type { TokenSymbol } from "@/lib/tokens";
import { displaySymbolOf, tokenMeta } from "@/lib/tokens";
import { getAppKit, makeAdapter } from "@/lib/appkit";
import { estimateNetworkFeeUsd, formatFeeUsd } from "@/lib/gas";
import { formatAmount } from "@/lib/format";

type AdapterFor = Awaited<ReturnType<typeof makeAdapter>>;

export type ConfirmQuote = {
  receiveAmount: string;
  minReceived: string | null;
  feePct: number | null;
};

type SimState =
  | { phase: "running" }
  | { phase: "passed" }
  | { phase: "failed"; error: string };

function impactColor(pct: number | null): string | undefined {
  if (pct == null) return undefined;
  if (pct > 5) return "var(--danger)";
  if (pct > 2) return "var(--warning)";
  return "var(--success)";
}

export function SwapConfirmModal({
  open,
  paySymbol,
  receiveSymbol,
  payAmount,
  quote,
  slippagePct,
  deadlineMinutes,
  busy,
  getAdapter,
  onConfirm,
  onClose,
}: {
  open: boolean;
  paySymbol: TokenSymbol;
  receiveSymbol: TokenSymbol;
  payAmount: string;
  quote: ConfirmQuote | null;
  slippagePct: number;
  deadlineMinutes: number;
  busy: boolean;
  getAdapter: () => Promise<AdapterFor>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [sim, setSim] = useState<SimState>({ phase: "running" });
  const [feeUsd, setFeeUsd] = useState<number | null>(null);
  const [feeLoading, setFeeLoading] = useState(true);

  // Re-run simulation + fee estimate each time the modal opens.
  useEffect(() => {
    if (!open || !quote) return;

    const adapterPromise = getAdapter();
    setSim({ phase: "running" });
    adapterPromise
      .then((adapter) =>
        getAppKit().estimateSwap({
          from: { adapter, chain: "Arc_Testnet" },
          tokenIn: paySymbol,
          tokenOut: receiveSymbol,
          amountIn: payAmount,
          config: { slippageBps: Math.round(slippagePct * 100) },
        })
      )
      .then(
        () => setSim({ phase: "passed" }),
        (err: unknown) =>
          setSim({
            phase: "failed",
            error: err instanceof Error ? err.message : String(err),
          })
      );

    let cancelled = false;
    setFeeLoading(true);
    estimateNetworkFeeUsd().then((fee) => {
      if (cancelled) return;
      setFeeUsd(fee);
      setFeeLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, busy, onClose]);

  if (!open || !quote) return null;

  const payMeta = tokenMeta(paySymbol);
  const receiveMeta = tokenMeta(receiveSymbol);
  const rate =
    Number(payAmount) > 0
      ? Number(quote.receiveAmount) / Number(payAmount)
      : 0;

  const canConfirm = sim.phase === "passed" && !busy;

  return (
    <div
      className="animate-pop-in fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Review swap"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--background)] p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Review swap</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
            className="rounded-md p-1 text-sm leading-none text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {/* You pay */}
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2.5">
          <span className="text-xs text-[var(--muted)]">You pay</span>
          <span className="mono flex items-center gap-2 text-sm font-semibold">
            {formatAmount(Number(payAmount))}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={payMeta.logo}
              alt=""
              className="h-5 w-5 rounded-full object-cover"
            />
            {displaySymbolOf(payMeta)}
          </span>
        </div>

        {/* You receive */}
        <div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2.5">
          <span className="text-xs text-[var(--muted)]">You receive</span>
          <span className="mono flex items-center gap-2 text-sm font-semibold">
            ≈ {formatAmount(Number(quote.receiveAmount))}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiveMeta.logo}
              alt=""
              className="h-5 w-5 rounded-full object-cover"
            />
            {displaySymbolOf(receiveMeta)}
          </span>
        </div>

        <div className="mt-3 space-y-1 px-1 text-xs">
          <p className="flex justify-between">
            <span className="text-[var(--muted)]">Rate</span>
            <span className="mono">
              1 {paySymbol} ≈ {formatAmount(rate)} {receiveSymbol}
            </span>
          </p>
          <p className="flex justify-between">
            <span className="text-[var(--muted)]">
              Min. received ({slippagePct}% max slippage)
            </span>
            <span className="mono">
              {quote.minReceived
                ? `${formatAmount(Number(quote.minReceived))} ${receiveSymbol}`
                : "—"}
            </span>
          </p>
          <p className="flex justify-between">
            <span className="text-[var(--muted)]">Price impact</span>
            <span className="mono" style={{ color: impactColor(quote.feePct) }}>
              {quote.feePct == null ? "—" : `${quote.feePct.toFixed(2)}%`}
            </span>
          </p>
          <p className="flex justify-between">
            <span className="text-[var(--muted)]">Network fee</span>
            <span className="mono">
              {feeLoading ? "estimating…" : formatFeeUsd(feeUsd)}
            </span>
          </p>
          <p className="flex justify-between">
            <span className="text-[var(--muted)]">Deadline</span>
            <span className="mono">{deadlineMinutes} min</span>
          </p>
        </div>

        {/* Simulation result */}
        <div className="mt-3">
          {sim.phase === "running" && (
            <p className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
              Simulating transaction…
            </p>
          )}
          {sim.phase === "passed" && (
            <p
              className="flex items-center gap-2 text-xs font-medium"
              style={{ color: "var(--success)" }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
                  clipRule="evenodd"
                />
              </svg>
              Simulation passed
            </p>
          )}
          {sim.phase === "failed" && (
            <p
              className="rounded-lg border px-2.5 py-2 text-xs"
              style={{
                color: "var(--danger)",
                borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)",
                background:
                  "color-mix(in srgb, var(--danger) 5%, transparent)",
              }}
            >
              ✗ Simulation failed:{" "}
              <span className="break-words">{sim.error}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className="mt-4 w-full cursor-pointer rounded-xl bg-[var(--accent)] py-3 text-base font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sim.phase === "failed"
            ? "Retry simulation by reopening"
            : busy
              ? "Swapping…"
              : sim.phase === "passed"
                ? "Confirm swap"
                : "Simulating…"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="mt-2 w-full cursor-pointer rounded-xl border border-[var(--border)] py-2.5 text-sm transition-colors hover:border-[var(--border-strong)] disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
