"use client";

import { useState } from "react";
import type { TokenSymbol } from "@/lib/tokens";
import { displaySymbolOf, tokenMeta } from "@/lib/tokens";
import type { Balances } from "@/lib/balances";
import { TokenPicker } from "@/components/TokenPicker";

export function TokenBadge({
  symbol,
  onChange,
  balances,
}: {
  symbol: TokenSymbol;
  onChange?: (s: TokenSymbol) => void;
  balances?: Balances;
}) {
  const meta = tokenMeta(symbol);
  const [open, setOpen] = useState(false);

  if (!onChange) {
    return (
      <span className="token-chip mono flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
        <TokenDot symbol={symbol} />
        {displaySymbolOf(meta)}
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        aria-label={`Change token, current ${displaySymbolOf(meta)}`}
        onClick={() => setOpen(true)}
        className="token-chip mono flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none transition hover:border-[var(--border-strong)]"
      >
        <TokenDot symbol={symbol} />
        {displaySymbolOf(meta)}
        <span className="text-[10px] text-[var(--muted)]" aria-hidden>
          ▾
        </span>
      </button>
      <TokenPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={onChange}
        balances={balances}
      />
    </>
  );
}

export function TokenDot({ symbol }: { symbol: string }) {
  const meta = tokenMeta(symbol);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={meta.logo}
      alt={displaySymbolOf(meta)}
      className="h-5 w-5 rounded-full object-cover"
      draggable={false}
    />
  );
}
