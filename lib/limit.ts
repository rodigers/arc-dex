"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EIP1193Provider } from "viem";
import { getAppKit, makeAdapter } from "@/lib/appkit";
import { priceFor, useMarketPrices, type MarketPrice } from "@/lib/market";
import { useToast } from "@/lib/toast";
import { formatAmount } from "@/lib/format";
import type { TokenSymbol } from "@/lib/tokens";

/**
 * Client-side limit orders stored in localStorage. A polling loop re-checks
 * the market cross-rate every 30s while any order is open AND a wallet is
 * connected; when the target is crossed the swap executes through App Kit
 * (same flow as the manual swap button).
 */

const STORAGE_KEY = "arcswap_limit_orders";
export const LIMIT_POLL_MS = 30_000;
export const LIMIT_SLIPPAGE_BPS = 300;

export type LimitSide = "above" | "below";
export type LimitOrderStatus = "open" | "filled" | "failed" | "expired";

export type LimitOrder = {
  id: string;
  paySymbol: TokenSymbol;
  receiveSymbol: TokenSymbol;
  amount: string;
  targetRate: number;
  side: LimitSide;
  createdAt: number;
  expiresAt: number;
  status: LimitOrderStatus;
  txHash?: string;
  settledAt?: number;
};

function loadOrders(): LimitOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is LimitOrder =>
        typeof o === "object" &&
        o !== null &&
        typeof (o as LimitOrder).id === "string" &&
        typeof (o as LimitOrder).targetRate === "number"
    );
  } catch {
    return [];
  }
}

function saveOrders(orders: LimitOrder[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // storage unavailable — orders stay in-memory only
  }
}

/** Cross rate: how many `receiveSymbol` one unit of `paySymbol` buys. */
export function crossRate(
  prices: Record<string, MarketPrice> | null,
  paySymbol: TokenSymbol,
  receiveSymbol: TokenSymbol
): number | null {
  if (!prices) return null;
  const pay = priceFor(prices, paySymbol);
  const receive = priceFor(prices, receiveSymbol);
  if (!pay?.usd || !receive?.usd) return null;
  return pay.usd / receive.usd;
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

type Connection = { provider: EIP1193Provider; address: string };

/**
 * Limit-order engine: persistence + the 30s market-checking loop that fills
 * crossed targets. Mounted app-wide so orders are evaluated on every tab.
 */
export function useLimitOrderEngine({
  connection,
  onSwapped,
}: {
  connection: Connection | null;
  onSwapped?: () => void;
}): {
  orders: LimitOrder[];
  openOrders: LimitOrder[];
  history: LimitOrder[];
  prices: Record<string, MarketPrice> | null;
  createOrder: (
    input: Omit<
      LimitOrder,
      "id" | "createdAt" | "expiresAt" | "status" | "side"
    > & { expiresAt: number }
  ) => boolean;
  cancelOrder: (id: string) => void;
} {
  const { toast } = useToast();
  const { prices } = useMarketPrices();
  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [mounted, setMounted] = useState(false);
  const busyRef = useRef(false);

  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const onSwappedRef = useRef(onSwapped);
  onSwappedRef.current = onSwapped;

  useEffect(() => {
    setMounted(true);
    setOrders(loadOrders());
  }, []);

  const commit = useCallback((next: LimitOrder[]) => {
    saveOrders(next);
    setOrders(next);
  }, []);

  const executeOrder = useCallback(
    async (order: LimitOrder) => {
      const conn = connectionRef.current;
      if (!conn || busyRef.current) return false;
      busyRef.current = true;
      try {
        const adapter = await makeAdapter(conn.provider);
        const result = await getAppKit().swap({
          from: { adapter, chain: "Arc_Testnet" },
          tokenIn: order.paySymbol,
          tokenOut: order.receiveSymbol,
          amountIn: order.amount,
          config: { slippageBps: LIMIT_SLIPPAGE_BPS },
        });
        const current = loadOrders();
        commit(
          current.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  status: "filled" as const,
                  settledAt: Date.now(),
                  txHash: result.txHash ?? undefined,
                }
              : o
          )
        );
        toast({
          title: `Limit order filled · ${order.paySymbol}→${order.receiveSymbol}`,
          description: `${order.amount} ${order.paySymbol} @ ${formatAmount(order.targetRate)}`,
        });
        onSwappedRef.current?.();
        return true;
      } catch (err) {
        const current = loadOrders();
        commit(
          current.map((o) =>
            o.id === order.id
              ? { ...o, status: "failed" as const, settledAt: Date.now() }
              : o
          )
        );
        toast({
          variant: "error",
          title: `Limit order failed · ${order.paySymbol}→${order.receiveSymbol}`,
          description: err instanceof Error ? err.message : String(err),
        });
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [commit, toast]
  );

  // 30s polling loop: expire stale orders, fill crossed targets.
  const hasOpen = orders.some((o) => o.status === "open");
  const connected = !!connection;
  useEffect(() => {
    if (!mounted || !connected || !hasOpen) return;

    async function tick() {
      const conn = connectionRef.current;
      if (!conn || busyRef.current) return;
      const current = loadOrders();
      const now = Date.now();

      let changed = false;
      const expired: LimitOrder[] = [];
      const kept = current.map((o) => {
        if (o.status === "open" && now >= o.expiresAt) {
          changed = true;
          const row = { ...o, status: "expired" as const, settledAt: now };
          expired.push(row);
          return row;
        }
        return o;
      });

      const due = kept.find((o) => {
        if (o.status !== "open") return false;
        const rate = crossRate(prices, o.paySymbol, o.receiveSymbol);
        if (rate == null) return false;
        return o.side === "above" ? rate >= o.targetRate : rate <= o.targetRate;
      });

      if (due) {
        // Persist expiry changes before executing so state stays consistent.
        if (changed) saveOrders(kept);
        await executeOrder(due);
        return;
      }
      if (changed) commit(kept);
    }

    void tick();
    const t = setInterval(() => void tick(), LIMIT_POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, connected, hasOpen, executeOrder, commit]);

  const createOrder = useCallback(
    (
      input: Omit<
        LimitOrder,
        "id" | "createdAt" | "expiresAt" | "status" | "side"
      > & { expiresAt: number }
    ): boolean => {
      const now = Date.now();
      const rate = crossRate(prices, input.paySymbol, input.receiveSymbol);
      const side: LimitSide =
        rate != null && input.targetRate <= rate ? "below" : "above";
      const order: LimitOrder = {
        ...input,
        id: newId(),
        side,
        createdAt: now,
        status: "open",
      };
      commit([order, ...loadOrders()]);
      return true;
    },
    [commit, prices]
  );

  const cancelOrder = useCallback(
    (id: string) => {
      commit(loadOrders().filter((o) => o.id !== id));
    },
    [commit]
  );

  const openOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === "open")
        .sort((a, b) => a.createdAt - b.createdAt),
    [orders]
  );
  const history = useMemo(
    () =>
      orders
        .filter((o) => o.status !== "open")
        .sort((a, b) => (b.settledAt ?? b.createdAt) - (a.settledAt ?? a.createdAt))
        .slice(0, 10),
    [orders]
  );

  return { orders, openOrders, history, prices, createOrder, cancelOrder };
}
