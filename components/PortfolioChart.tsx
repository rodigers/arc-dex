"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadPortfolioHistory,
  type PortfolioPoint,
} from "@/lib/history";
import { formatUsd } from "@/lib/format";

/**
 * Portfolio history sparkline with min/max labels and % change since the
 * first recorded snapshot. SVG approach mirrors PriceChart.
 */

const W = 300;
const H = 64;
const PAD = 4;

function buildPath(points: PortfolioPoint[]) {
  const vs = points.map((p) => p.v);
  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);
  const spanY = maxV - minV || 1;
  const firstT = points[0].t;
  const spanX = points[points.length - 1].t - firstT || 1;

  const coords = points.map((p) => {
    const x = PAD + ((p.t - firstT) / spanX) * (W - PAD * 2);
    const y = H - PAD - ((p.v - minV) / spanY) * (H - PAD * 2);
    return [x, y] as const;
  });

  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${W - PAD},${H} L${PAD},${H} Z`;
  return { line, area };
}

export function PortfolioChart() {
  const [points, setPoints] = useState<PortfolioPoint[]>([]);

  // Load (and re-load briefly after mount in case a snapshot was just taken).
  useEffect(() => {
    setPoints(loadPortfolioHistory());
    const t = setTimeout(() => setPoints(loadPortfolioHistory()), 1500);
    return () => clearTimeout(t);
  }, []);

  const up =
    points.length >= 2 &&
    points[points.length - 1].v >= points[0].v;
  const color = up ? "var(--success)" : "var(--danger)";

  const changePct =
    points.length >= 2 && points[0].v > 0
      ? ((points[points.length - 1].v - points[0].v) / points[0].v) * 100
      : null;

  const stats = useMemo(() => {
    if (points.length < 2) return null;
    const vs = points.map((p) => p.v);
    return {
      min: Math.min(...vs),
      max: Math.max(...vs),
      last: vs[vs.length - 1],
    };
  }, [points]);

  if (points.length < 2 || !stats) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-[11px] text-[var(--muted)]">
        Portfolio history builds a point every 10 minutes — check back soon.
      </div>
    );
  }

  const { line, area } = buildPath(points);

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-wide text-[var(--muted)]">
          History
        </span>
        {changePct != null && (
          <span className="mono font-medium" style={{ color }}>
            {up ? "+" : ""}
            {changePct.toFixed(2)}%
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 h-16 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Portfolio value history"
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

      <div className="mono mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
        <span>L {formatUsd(stats.min)}</span>
        <span>now {formatUsd(stats.last)}</span>
        <span>H {formatUsd(stats.max)}</span>
      </div>
    </div>
  );
}
