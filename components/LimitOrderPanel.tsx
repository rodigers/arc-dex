"use client";

import { useEffect, useMemo, useState } from "react";
import type { EIP1193Provider } from "viem";
import { TokenBadge } from "@/components/TokenBadge";
import {
  useLimitOrderEngine,
  crossRate,
  LIMIT_SLIPPAGE_BPS,
  type LimitOrder,
} from "@/lib/limit";
import { formatAmount } from "@/lib/format";

type Connection = { provider: EIP1193Provider; address: string };

const EXPIRY_OPTIONS = [
  { label: "1h", ms: 60 * 60_000 },
  { label: "24h", ms: 24 * 60 * 60_000 },
  { label: "7d", ms: 7 * 24 * 60 * 60_000 },
] as const;

function countdown(expiresAt: number, now: number): string {
  const s = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

function OrderRow({
  order,
  prices,
  now,
  onCancel,
}: {
  order: LimitOrder;
  prices: Parameters<typeof crossRate>[0];
  now: number;
  onCancel?: (id: string) => void;
}) {
  const live = crossRate(prices, order.paySymbol, order.receiveSymbol);
  // Favorable = the market has moved in the direction the order wants.
  const favorable =
    live != null &&
    (order.side === "above" ? live >= order.targetRate : live <= order.targetRate);

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="mono truncate font-medium">
          {formatAmount(Number(order.amount))} {order.paySymbol} →{" "}
          {order.receiveSymbol}
        </span>
        <span className="mono shrink-0 text-xs text-[var(--muted)]">
          target {formatAmount(order.targetRate)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="mono">
          live{" "}
          <span
            style={{ color: favorable ? "var(--success)" : undefined }}
            className={favorable ? "font-semibold" : "text-[var(--muted)]"}
          >
            {live != null ? formatAmount(live) : "—"}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="mono text-[var(--muted)]">
            expires in {countdown(order.expiresAt, now)}
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={() => onCancel(order.id)}
              className="cursor-pointer rounded-lg border border-[var(--border)] px-2 py-0.5 transition-colors hover:border-red-500/50 hover:text-red-500"
            >
              Cancel
            </button>
          )}
        </span>
      </div>
    </li>
  );
}

export function LimitOrderPanel({
  connection,
  onSwapped,
}: {
  connection: Connection | null;
  onSwapped?: () => void;
}) {
  const engine = useLimitOrderEngine({ connection, onSwapped });
  const [paySymbol, setPaySymbol] = useState<"USDC" | "EURC">("USDC");
  const [receiveSymbol, setReceiveSymbol] = useState<"USDC" | "EURC">("EURC");
  const [amount, setAmount] = useState("");
  const [targetText, setTargetText] = useState("");
  const [expiryIdx, setExpiryIdx] = useState(1);
  const [now, setNow] = useState(() => Date.now());

  const formRate = useMemo(
    () =>
      connection
        ? crossRate(engine.prices, paySymbol, receiveSymbol)
        : null,
    [connection, engine.prices, paySymbol, receiveSymbol]
  );

  // Prefill / refresh the target-rate input from the live market rate.
  useEffect(() => {
    if (formRate != null) {
      setTargetText((prev) => {
        const parsed = Number(prev);
        if (prev === "" || !Number.isFinite(parsed) || parsed <= 0) {
          return String(Number(formRate.toFixed(6)));
        }
        return prev;
      });
    }
  }, [formRate]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function nudge(pct: number) {
    const base = Number(targetText);
    if (!Number.isFinite(base) || base <= 0) return;
    setTargetText(String(Number((base * (1 + pct)).toFixed(6))));
  }

  const parsedTarget = Number(targetText);
  const parsedAmount = Number(amount);
  const validForm =
    !!connection &&
    formRate != null &&
    Number.isFinite(parsedTarget) &&
    parsedTarget > 0 &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0;

  function create() {
    if (!validForm) return;
    engine.createOrder({
      paySymbol,
      receiveSymbol,
      amount: amount.trim(),
      targetRate: parsedTarget,
      expiresAt: Date.now() + EXPIRY_OPTIONS[expiryIdx].ms,
    });
    setAmount("");
  }

  return (
    <section className="card-hover rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="text-xs font-medium text-[var(--muted)]">
        Limit orders · executes automatically when the rate crosses your target
      </div>

      {/* Form */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3">
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="mono min-w-0 flex-1 bg-transparent text-xl outline-none placeholder:text-[var(--muted)]/50"
            aria-label="Limit order amount"
          />
          <TokenBadge
            symbol={paySymbol}
            onChange={(s) => {
              if ((s === "USDC" || s === "EURC") && s !== receiveSymbol)
                setPaySymbol(s);
            }}
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3">
          <span className="mono min-w-0 flex-1 bg-transparent text-xl text-[var(--muted)]">
            →
          </span>
          <TokenBadge
            symbol={receiveSymbol}
            onChange={(s) => {
              if ((s === "USDC" || s === "EURC") && s !== paySymbol)
                setReceiveSymbol(s);
            }}
          />
        </div>

        <div className="rounded-xl border border-[var(--border)] p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>Target rate ({receiveSymbol} per 1 {paySymbol})</span>
            <span className="mono">market {formRate != null ? formatAmount(formRate) : "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={targetText}
              onChange={(e) => setTargetText(e.target.value.replace(/[^0-9.]/g, ""))}
              className="mono min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-[var(--muted)]/50"
              aria-label="Target rate"
            />
            <button
              type="button"
              onClick={() => nudge(-0.01)}
              className="cursor-pointer rounded-lg border border-[var(--border)] px-2 py-1 text-xs transition-colors hover:border-[var(--border-strong)]"
              aria-label="Lower target by 1%"
            >
              −1%
            </button>
            <button
              type="button"
              onClick={() => nudge(0.01)}
              className="cursor-pointer rounded-lg border border-[var(--border)] px-2 py-1 text-xs transition-colors hover:border-[var(--border-strong)]"
              aria-label="Raise target by 1%"
            >
              +1%
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--border)] p-0.5">
            {EXPIRY_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setExpiryIdx(i)}
                className={`mono cursor-pointer rounded-md px-3 py-1 text-xs transition-colors ${
                  expiryIdx === i
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!validForm}
          onClick={create}
          className="w-full cursor-pointer rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {connection ? "Place limit order" : "Connect wallet"}
        </button>
      </div>

      {/* Open orders */}
      {engine.openOrders.length > 0 && (
        <>
          <div className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Open orders
          </div>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
            {engine.openOrders.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                prices={engine.prices}
                now={now}
                onCancel={engine.cancelOrder}
              />
            ))}
          </ul>
        </>
      )}

      {/* History */}
      {engine.history.length > 0 && (
        <>
          <div className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            History
          </div>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
            {engine.history.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <span className="mono truncate">
                  {formatAmount(Number(o.amount))} {o.paySymbol}→{o.receiveSymbol} @{" "}
                  {formatAmount(o.targetRate)}
                </span>
                <span
                  className="shrink-0 font-medium capitalize"
                  style={{
                    color:
                      o.status === "filled"
                        ? "var(--success)"
                        : o.status === "failed"
                          ? "var(--danger)"
                          : "var(--muted)",
                  }}
                >
                  {o.status}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-3 text-[10px] text-[var(--muted)]">
        Checked every 30s while this tab is open · max slippage{" "}
        {LIMIT_SLIPPAGE_BPS / 100}%.
      </p>
    </section>
  );
}
