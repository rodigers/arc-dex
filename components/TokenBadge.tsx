"use client";

import type { TokenSymbol } from "@/lib/tokens";
import { tokenMeta, TOKENS } from "@/lib/tokens";

export function TokenBadge({
  symbol,
  onChange,
}: {
  symbol: TokenSymbol;
  onChange?: (s: TokenSymbol) => void;
}) {
  const meta = tokenMeta(symbol);
  if (!onChange) {
    return (
      <span className="token-chip mono flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
        <TokenDot symbol={symbol} />
        {symbol}
      </span>
    );
  }
  return (
    <select
      value={symbol}
      onChange={(e) => onChange(e.target.value as TokenSymbol)}
      className="token-chip mono cursor-pointer appearance-none rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none"
    >
      {TOKENS.map((t) => (
        <option key={t.symbol} value={t.symbol}>
          {t.symbol}
        </option>
      ))}
    </select>
  );
}

export function TokenDot({ symbol }: { symbol: string }) {
  const meta = tokenMeta(symbol);
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: meta.color }}
      aria-hidden
    >
      {meta.glyph === "⛽" ? "G" : meta.glyph}
    </span>
  );
}
