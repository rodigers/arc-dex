"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EIP1193Provider } from "viem";
import { getAppKit, makeAdapter } from "@/lib/appkit";
import { useMarketPrices, type MarketPrice } from "@/lib/market";
import { useToast } from "@/lib/toast";
import { formatAmount } from "@/lib/format";
import type { TokenSymbol } from "@/lib/tokens";

/**
 * DCA (dollar-cost-averaging) plans stored in localStorage. A polling loop
 * checks every 30s while any plan is active AND a wallet is connected; when a
 * plan's next run is due it executes through App Kit (same flow as manual
 * swaps) and schedules the next run.
 */

const STORAGE_KEY = "arcswap_dca_plans";
export const DCA_POLL_MS = 30_000;
export const DCA_SLIPPAGE_BPS = 300;

export type DcaInterval = "hourly" | "daily" | "weekly";

export const DCA_INTERVALS: Record<
  DcaInterval,
  { label: string; ms: number }
> = {
  hourly: { label: "Hourly", ms: 60 * 60_000 },
  daily: { label: "Daily", ms: 24 * 60 * 60_000 },
  weekly: { label: "Weekly", ms: 7 * 24 * 60 * 60_000 },
};

export type DcaPlan = {
  id: string;
  paySymbol: TokenSymbol;
  receiveSymbol: TokenSymbol;
  amount: string;
  interval: DcaInterval;
  createdAt: number;
  nextRunAt: number;
  paused: boolean;
  runs: number;
  lastTxHash?: string;
  lastError?: string;
};

function loadPlans(): DcaPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is DcaPlan =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as DcaPlan).id === "string" &&
        typeof (p as DcaPlan).nextRunAt === "number"
    );
  } catch {
    return [];
  }
}

function savePlans(plans: DcaPlan[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // storage unavailable — plans stay in-memory only
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

type Connection = { provider: EIP1193Provider; address: string };

/**
 * DCA engine: persistence + the 30s scheduling loop that fires due buys.
 */
export function useDcaEngine({
  connection,
  onSwapped,
}: {
  connection: Connection | null;
  onSwapped?: () => void;
}): {
  plans: DcaPlan[];
  activePlans: DcaPlan[];
  prices: Record<string, MarketPrice> | null;
  createPlan: (input: {
    paySymbol: TokenSymbol;
    receiveSymbol: TokenSymbol;
    amount: string;
    interval: DcaInterval;
  }) => boolean;
  removePlan: (id: string) => void;
  togglePause: (id: string) => void;
} {
  const { toast } = useToast();
  const { prices } = useMarketPrices();
  const [plans, setPlans] = useState<DcaPlan[]>([]);
  const [mounted, setMounted] = useState(false);
  const busyRef = useRef(false);

  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const onSwappedRef = useRef(onSwapped);
  onSwappedRef.current = onSwapped;

  useEffect(() => {
    setMounted(true);
    setPlans(loadPlans());
  }, []);

  const commit = useCallback((next: DcaPlan[]) => {
    savePlans(next);
    setPlans(next);
  }, []);

  const executePlan = useCallback(
    async (plan: DcaPlan) => {
      const conn = connectionRef.current;
      if (!conn || busyRef.current) return false;
      busyRef.current = true;
      try {
        const adapter = await makeAdapter(conn.provider);
        const result = await getAppKit().swap({
          from: { adapter, chain: "Arc_Testnet" },
          tokenIn: plan.paySymbol,
          tokenOut: plan.receiveSymbol,
          amountIn: plan.amount,
          config: { slippageBps: DCA_SLIPPAGE_BPS },
        });
        toast({
          title: `DCA buy executed · ${plan.paySymbol}→${plan.receiveSymbol}`,
          description: `${plan.amount} ${plan.paySymbol}${
            result.txHash ? ` · tx ${result.txHash.slice(0, 10)}…` : ""
          }`,
        });
        onSwappedRef.current?.();
        return true;
      } catch (err) {
        toast({
          variant: "error",
          title: `DCA buy failed · ${plan.paySymbol}→${plan.receiveSymbol}`,
          description: err instanceof Error ? err.message : String(err),
        });
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [toast]
  );

  // 30s scheduling loop: run due plans, reschedule regardless of outcome so a
  // failed run retries at the NEXT scheduled slot (never busy-loops).
  const hasActive = plans.some((p) => !p.paused);
  const connected = !!connection;
  useEffect(() => {
    if (!mounted || !connected || !hasActive) return;

    async function tick() {
      const current = loadPlans();
      const now = Date.now();
      const due = current.find((p) => !p.paused && now >= p.nextRunAt);
      if (!due) return;

      const ok = await executePlan(due);
      const stepMs = DCA_INTERVALS[due.interval].ms;
      const latest = loadPlans();
      commit(
        latest.map((p) =>
          p.id === due.id
            ? {
                ...p,
                runs: ok ? p.runs + 1 : p.runs,
                nextRunAt:
                  p.nextRunAt + stepMs > Date.now()
                    ? p.nextRunAt + stepMs
                    : Date.now() + stepMs,
                lastTxHash: undefined,
                lastError: ok ? undefined : "last run failed",
              }
            : p
        )
      );
    }

    void tick();
    const t = setInterval(() => void tick(), DCA_POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, connected, hasActive, executePlan, commit]);

  const createPlan = useCallback(
    (input: {
      paySymbol: TokenSymbol;
      receiveSymbol: TokenSymbol;
      amount: string;
      interval: DcaInterval;
    }): boolean => {
      const parsed = Number(input.amount);
      if (!Number.isFinite(parsed) || parsed <= 0) return false;
      const now = Date.now();
      const plan: DcaPlan = {
        ...input,
        id: newId(),
        createdAt: now,
        // First buy fires on the next poll (~immediately).
        nextRunAt: now,
        paused: false,
        runs: 0,
      };
      commit([plan, ...loadPlans()]);
      return true;
    },
    [commit]
  );

  const removePlan = useCallback(
    (id: string) => {
      commit(loadPlans().filter((p) => p.id !== id));
    },
    [commit]
  );

  const togglePause = useCallback(
    (id: string) => {
      commit(
        loadPlans().map((p) =>
          p.id === id
            ? p.paused
              ? { ...p, paused: false, nextRunAt: Date.now() }
              : { ...p, paused: true }
            : p
        )
      );
    },
    [commit]
  );

  const activePlans = useMemo(() => plans, [plans]);

  return { plans, activePlans, prices, createPlan, removePlan, togglePause };
}
