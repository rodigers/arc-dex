"use client";

import { useEffect, useRef, useState } from "react";
import {
  ensureNotificationPermission,
  usePriceAlertEngine,
  type AlertDirection,
} from "@/lib/alerts";
import { priceFor, useMarketPrices } from "@/lib/market";
import { useToast } from "@/lib/toast";
import { tokenMeta, type TokenSymbol } from "@/lib/tokens";
import { EmptyState } from "@/components/EmptyState";

const ALERT_SYMBOLS = ["USDC", "EURC"] as const;
type AlertSymbol = (typeof ALERT_SYMBOLS)[number];

/**
 * Header bell button + popover listing alerts and an add form.
 * Also owns the always-on 60s alert check loop via the engine hook.
 */
export function PriceAlerts() {
  const { toast } = useToast();
  const engine = usePriceAlertEngine({
    onTrigger: (alert) => {
      toast({
        title: `Price alert · ${alert.symbol}`,
        description: `${alert.symbol} is now ${alert.direction} $${alert.threshold}`,
      });
    },
  });

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [symbol, setSymbol] = useState<AlertSymbol>("EURC");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [thresholdText, setThresholdText] = useState("");

  // Current market price for prefilling the threshold input.
  const { prices } = useMarketPrices();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const untriggered = engine.alerts.filter((a) => a.triggeredAt == null).length;

  const current = priceFor(prices, symbol);

  function add() {
    const threshold = Number(thresholdText);
    if (!Number.isFinite(threshold) || threshold <= 0) return;
    ensureNotificationPermission();
    engine.addAlert({ symbol: symbol as TokenSymbol, direction, threshold });
    setThresholdText("");
    toast({ title: `Alert set · ${symbol} ${direction} $${threshold}` });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Price alerts${untriggered ? ` (${untriggered} active)` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {untriggered > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--background)]"
          />
        )}
      </button>

      {open && (
        <div className="animate-pop-in absolute right-0 top-11 z-50 w-72 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
          <div className="mb-2 text-sm font-semibold">Price alerts</div>

          {engine.alerts.length > 0 && (
            <ul className="mb-2 max-h-44 space-y-1 overflow-y-auto">
              {engine.alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs"
                >
                  <span className="mono min-w-0 truncate">
                    {a.symbol} {a.direction === "above" ? "≥" : "≤"} ${a.threshold}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className="text-[10px] font-medium"
                      style={{
                        color:
                          a.triggeredAt != null
                            ? "var(--success)"
                            : "var(--muted)",
                      }}
                    >
                      {a.triggeredAt != null ? "triggered" : "watching"}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove alert"
                      onClick={() => engine.removeAlert(a.id)}
                      className="cursor-pointer text-[var(--muted)] transition-colors hover:text-red-500"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {engine.alerts.length === 0 && (
            <div className="mb-3">
              <EmptyState
                compact
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                }
              >
                No alerts yet. Get pinged when USDC or EURC crosses a price.
              </EmptyState>
            </div>
          )}

          {/* Add form */}
          <div className="space-y-2 rounded-xl border border-[var(--border)] p-2.5">
            <div className="grid grid-cols-2 gap-1">
              {ALERT_SYMBOLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSymbol(s)}
                  className={`mono cursor-pointer rounded-lg px-2 py-1 text-xs transition-colors ${
                    symbol === s
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {tokenMeta(s).displaySymbol}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(["above", "below"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`cursor-pointer rounded-lg border px-2 py-1 text-xs capitalize transition-colors ${
                    direction === d
                      ? "border-[var(--accent)] font-medium"
                      : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="mono flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm">
              <span className="text-[var(--muted)]">$</span>
              <input
                inputMode="decimal"
                placeholder={current ? String(current.usd) : "0.00"}
                value={thresholdText}
                onChange={(e) =>
                  setThresholdText(e.target.value.replace(/[^0-9.]/g, ""))
                }
                onKeyDown={(e) => e.key === "Enter" && add()}
                className="w-full min-w-0 bg-transparent outline-none"
                aria-label="Alert price threshold"
              />
            </div>
            <button
              type="button"
              onClick={add}
              disabled={!(Number(thresholdText) > 0)}
              className="w-full cursor-pointer rounded-lg bg-[var(--accent)] py-2 text-xs font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create alert
            </button>
          </div>

          {engine.alerts.some((a) => a.triggeredAt != null) && (
            <button
              type="button"
              onClick={engine.clearTriggered}
              className="mt-2 w-full cursor-pointer text-center text-[11px] text-[var(--muted)] underline-offset-2 hover:underline"
            >
              Clear triggered alerts
            </button>
          )}
        </div>
      )}
    </div>
  );
}
