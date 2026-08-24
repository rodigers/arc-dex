"use client";

import { useEffect, useMemo, useState } from "react";
import type { TokenSymbol } from "@/lib/tokens";
import { displaySymbolOf, tokenMeta } from "@/lib/tokens";
import {
  COINGECKO_IDS,
  fetchSparkline,
  priceFor,
  useMarketPrices,
  type PricePoint,
} from "@/lib/market";

const CHART_SYMBOLS = ["USDC", "EURC"] as const;
type ChartSymbol = (typeof CHART_SYMBOLS)[number];

const W = 300;
const H = 88;
const PAD = 4;

function formatUsd(v: number) {
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: v < 1 ? 4 : 2,
  });
}

function buildPath(points: PricePoint[]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const coords = points.map((p) => {
    const x = PAD + ((p[0] - minX) / spanX) * (W - PAD * 2);
    const y = H - PAD - ((p[1] - minY) / spanY) * (H - PAD * 2);
    return [x, y] as const;
  });

  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${W - PAD},${H} L${PAD},${H} Z`;
  return { line, area };
}

function Sparkline({ points, color }: { points: PricePoint[]; color: string }) {
  const { line, area } = useMemo(() => buildPath(points), [points]);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-22 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="24 hour price chart"
    >
      <path d={area} fill={color} opacity={0.08} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function PriceChart() {
  const [symbol, setSymbol] = useState<ChartSymbol>("USDC");
  const { prices } = useMarketPrices();
  const [points, setPoints] = useState<PricePoint[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPoints(null);
    const id = COINGECKO_IDS[symbol as TokenSymbol];
    if (!id) return;
    fetchSparkline(id).then((pts) => {
      if (cancelled) return;
      setPoints(pts);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const meta = tokenMeta(symbol);
  const market = priceFor(prices, symbol as TokenSymbol);
  const change = market?.change24h ?? null;
  const up = change != null ? change >= 0 : true;
  const color = up ? "var(--success)" : "var(--danger)";

  // Fall back to sparkline-derived stats when the simple price call failed.
  const lastPrice =
    market?.usd ?? (points ? points[points.length - 1][1] : null);
  const fallbackChange =
    points && market?.change24h == null
      ? ((points[points.length - 1][1] - points[0][1]) / points[0][1]) * 100
      : null;
  const shownChange = change ?? fallbackChange;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meta.logo}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
            draggable={false}
          />
          <div>
            <div className="mono text-sm font-semibold">
              {displaySymbolOf(meta)}
              <span className="text-[var(--muted)]">/USD</span>
            </div>
            <div className="text-[10px] text-[var(--muted)]">24h · Arc</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] p-0.5">
          {CHART_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSymbol(s)}
              className={`mono cursor-pointer rounded-md px-2 py-1 text-xs transition-colors ${
                symbol === s
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="mono text-xl font-semibold">
          {lastPrice != null ? formatUsd(lastPrice) : "—"}
        </span>
        {shownChange != null && (
          <span
            className="mono rounded-md px-1.5 py-0.5 text-xs font-medium"
            style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            {up ? "▲" : "▼"} {Math.abs(shownChange).toFixed(2)}%
          </span>
        )}
      </div>

      <div className="mt-2">
        {loading ? (
          <div className="skeleton h-22 w-full rounded-lg" />
        ) : points ? (
          <Sparkline points={points} color={color} />
        ) : (
          <div
            className="flex h-22 items-center justify-center rounded-lg border border-dashed border-[var(--border)]"
            role="img"
            aria-label="Price chart unavailable"
          >
            <svg width="120" height="40" viewBox="0 0 120 40" aria-hidden>
              <polyline
                points="0,30 20,26 40,28 60,18 80,22 100,10 120,14"
                fill="none"
                stroke="var(--muted)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.5"
              />
            </svg>
          </div>
        )}
        {!loading && !points && (
          <p className="mt-1 text-center text-[10px] text-[var(--muted)]">
            Live price data unavailable — check your connection.
          </p>
        )}
      </div>
    </section>
  );
}
