"use client";

import { useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";
import { TokenBadge } from "@/components/TokenBadge";
import {
  DCA_INTERVALS,
  useDcaEngine,
  type DcaInterval,
} from "@/lib/dca";
import { formatAmount } from "@/lib/format";
import type { TokenSymbol } from "@/lib/tokens";

type Connection = { provider: EIP1193Provider; address: string };

const INTERVAL_KEYS = Object.keys(DCA_INTERVALS) as DcaInterval[];

function countdown(nextRunAt: number, now: number): string {
  const s = Math.max(0, Math.floor((nextRunAt - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

function PlanRow({
  plan,
  now,
  onTogglePause,
  onRemove,
}: {
  plan: ReturnType<typeof useDcaEngine>["plans"][number];
  now: number;
  onTogglePause: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={`mono truncate font-medium ${plan.paused ? "opacity-50" : ""}`}>
          {formatAmount(Number(plan.amount))} {plan.paySymbol} →{" "}
          {plan.receiveSymbol}
        </span>
        <span className="mono shrink-0 text-xs text-[var(--muted)]">
          {DCA_INTERVALS[plan.interval].label}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="mono">
          {plan.paused ? (
            <span className="text-[var(--muted)]">paused</span>
          ) : (
            <>
              next in{" "}
              <span className="font-semibold">
                {countdown(plan.nextRunAt, now)}
              </span>
            </>
          )}
          {plan.lastError && (
            <span className="ml-2" style={{ color: "var(--warning)" }}>
              {plan.lastError}
            </span>
          )}
        </span>
        <span className="flex items-center gap-3">
          <span className="mono text-[var(--muted)]">
            {plan.runs} run{plan.runs === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => onTogglePause(plan.id)}
            className="cursor-pointer rounded-lg border border-[var(--border)] px-2 py-0.5 transition-colors hover:border-[var(--border-strong)]"
          >
            {plan.paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => onRemove(plan.id)}
            aria-label="Delete plan"
            className="cursor-pointer rounded-lg border border-[var(--border)] px-2 py-0.5 transition-colors hover:border-red-500/50 hover:text-red-500"
          >
            Delete
          </button>
        </span>
      </div>
    </li>
  );
}

export function DcaPanel({
  connection,
  onSwapped,
}: {
  connection: Connection | null;
  onSwapped?: () => void;
}) {
  const engine = useDcaEngine({ connection, onSwapped });
  const [paySymbol, setPaySymbol] = useState<"USDC" | "EURC">("USDC");
  const [receiveSymbol, setReceiveSymbol] = useState<"USDC" | "EURC">("EURC");
  const [amount, setAmount] = useState("");
  const [interval, setIntervalKey] = useState<DcaInterval>("weekly");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const parsedAmount = Number(amount);
  const validForm =
    !!connection &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    paySymbol !== receiveSymbol;

  function create() {
    if (!validForm) return;
    engine.createPlan({
      paySymbol,
      receiveSymbol,
      amount: amount.trim(),
      interval,
    });
    setAmount("");
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="text-xs font-medium text-[var(--muted)]">
        Dollar-cost averaging · buys automatically on a schedule while your
        wallet is connected
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
            aria-label="Recurring amount"
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
            → every
          </span>
          <TokenBadge
            symbol={receiveSymbol}
            onChange={(s) => {
              if ((s === "USDC" || s === "EURC") && s !== paySymbol)
                setReceiveSymbol(s);
            }}
          />
        </div>

        <div className="flex justify-end">
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--border)] p-0.5">
            {INTERVAL_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setIntervalKey(key)}
                className={`mono cursor-pointer rounded-md px-3 py-1 text-xs transition-colors ${
                  interval === key
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {DCA_INTERVALS[key].label}
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
          {connection ? "Start DCA plan" : "Connect wallet"}
        </button>
      </div>

      {/* Active plans */}
      {engine.plans.length > 0 && (
        <>
          <div className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Your plans
          </div>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
            {engine.plans.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                now={now}
                onTogglePause={engine.togglePause}
                onRemove={engine.removePlan}
              />
            ))}
          </ul>
        </>
      )}

      <p className="mt-3 text-[10px] text-[var(--muted)]">
        Runs execute while this app is open and your wallet is connected · max
        slippage {300 / 100}%.
      </p>
    </section>
  );
}
