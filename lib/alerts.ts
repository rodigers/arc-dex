"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { priceFor, useMarketPrices } from "@/lib/market";
import type { TokenSymbol } from "@/lib/tokens";

/**
 * Price alerts persisted in localStorage. A 60s check loop evaluates each
 * untriggered alert against market prices; triggers fire via the
 * Notification API (when permitted) or an in-app fallback handled by the
 * caller through `onTrigger`.
 */

const STORAGE_KEY = "arcswap_alerts";
export const ALERTS_POLL_MS = 60_000;
/** Triggered alerts stay visible for 1h before auto-removal. */
export const TRIGGERED_TTL_MS = 60 * 60_000;

export type AlertDirection = "above" | "below";

export type PriceAlert = {
  id: string;
  symbol: TokenSymbol;
  direction: AlertDirection;
  threshold: number;
  createdAt: number;
  triggeredAt: number | null;
};

function loadAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is PriceAlert =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as PriceAlert).id === "string" &&
        typeof (a as PriceAlert).threshold === "number"
    );
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // storage unavailable — alerts stay in-memory only
  }
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ask for Notification permission once, when the first alert is created. */
export function ensureNotificationPermission() {
  try {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
  } catch {
    // Notifications unsupported — in-app toast will be used instead.
  }
}

function fireNotification(symbol: string, direction: AlertDirection, threshold: number) {
  const title = `Price alert · ${symbol}`;
  const body = `${symbol} is now ${direction} $${threshold}`;
  try {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
      return true;
    }
  } catch {
    // fall back to in-app
  }
  return false;
}

/**
 * Alert engine: owns persistence + the 60s evaluation loop. Must stay
 * mounted (header) so alerts keep being checked.
 */
export function usePriceAlertEngine({
  onTrigger,
}: {
  onTrigger?: (alert: PriceAlert) => void;
} = {}): {
  alerts: PriceAlert[];
  addAlert: (input: {
    symbol: TokenSymbol;
    direction: AlertDirection;
    threshold: number;
  }) => void;
  removeAlert: (id: string) => void;
  clearTriggered: () => void;
} {
  const { prices } = useMarketPrices();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [mounted, setMounted] = useState(false);

  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  useEffect(() => {
    setMounted(true);
    setAlerts(loadAlerts());
  }, []);

  const commit = useCallback((next: PriceAlert[]) => {
    saveAlerts(next);
    setAlerts(next);
  }, []);

  const hasUntriggered = mounted && alerts.some((a) => a.triggeredAt == null);

  useEffect(() => {
    if (!hasUntriggered) return;

    const tick = () => {
      const current = loadAlerts();
      const now = Date.now();
      let changed = false;

      const evaluated = current.map((a) => {
        if (a.triggeredAt != null) return a;
        const market = priceFor(pricesRef.current, a.symbol);
        if (!market?.usd) return a;
        const hit =
          a.direction === "above"
            ? market.usd >= a.threshold
            : market.usd <= a.threshold;
        if (!hit) return a;
        changed = true;
        const triggered: PriceAlert = { ...a, triggeredAt: now };
        const delivered = fireNotification(a.symbol, a.direction, a.threshold);
        if (!delivered) onTriggerRef.current?.(triggered);
        return triggered;
      });

      const pruned = evaluated.filter(
        (a) => a.triggeredAt == null || now - a.triggeredAt < TRIGGERED_TTL_MS
      );

      if (changed || pruned.length !== current.length) commit(pruned);
    };

    void tick();
    const t = setInterval(tick, ALERTS_POLL_MS);
    return () => clearInterval(t);
  }, [hasUntriggered, commit]);

  const addAlert = useCallback(
    (input: { symbol: TokenSymbol; direction: AlertDirection; threshold: number }) => {
      const alert: PriceAlert = {
        id: newId(),
        symbol: input.symbol,
        direction: input.direction,
        threshold: input.threshold,
        createdAt: Date.now(),
        triggeredAt: null,
      };
      commit([alert, ...loadAlerts()]);
    },
    [commit]
  );

  const removeAlert = useCallback(
    (id: string) => {
      commit(loadAlerts().filter((a) => a.id !== id));
    },
    [commit]
  );

  const clearTriggered = useCallback(() => {
    commit(loadAlerts().filter((a) => a.triggeredAt == null));
  }, [commit]);

  return { alerts, addAlert, removeAlert, clearTriggered };
}
