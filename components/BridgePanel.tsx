"use client";

import { useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";
import {
  useBridge,
  chainLabel,
  type BridgeChainId,
} from "@/lib/bridge";
import { ARC_EXPLORER } from "@/lib/tokens";
import { TokenDot } from "@/components/TokenBadge";
import { ChainPicker } from "@/components/ChainPicker";
import { recordBridgeJob } from "@/components/BridgeTracker";

type Connection = { provider: EIP1193Provider; address: string };

export function BridgePanel({
  connection,
  getAdapter,
  onBridged,
}: {
  connection: Connection | null;
  getAdapter: () => Promise<never>;
  onBridged: () => void;
}) {
  const { estimating, bridging, estimate, error, doEstimate, doBridge } =
    useBridge();
  const [fromChain, setFromChain] = useState<BridgeChainId>("Ethereum_Sepolia");
  const [toChain, setToChain] = useState<BridgeChainId>("Arc_Testnet");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");

  // live quote with debounce
  useEffect(() => {
    if (
      !connection ||
      !amount ||
      Number(amount) <= 0 ||
      fromChain === toChain
    ) {
      return;
    }
    const t = setTimeout(() => {
      doEstimate(
        getAdapter() as never,
        fromChain,
        toChain,
        amount
      );
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, amount, fromChain, toChain]);

  async function handleBridge() {
    if (!connection || !amount || bridging) return;
    const res = await doBridge(
      getAdapter() as never,
      fromChain,
      toChain,
      amount
    );
    if (res.ok) {
      setTxHash(res.hash);
      recordBridgeJob({ txHash: res.hash, fromChain, toChain });
      setAmount("");
      onBridged();
    }
  }

  const ready = Boolean(connection) && Number(amount) > 0 && fromChain !== toChain;

  return (
    <section className="card rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted)]">
          Bridge USDC (CCTP)
        </span>
        <span className="text-[10px] text-[var(--muted)]">1:1 native</span>
      </div>

      {/* From */}
      <div className="mt-3 rounded-xl border border-[var(--border)] p-3.5">
        <label className="text-[11px] text-[var(--muted)]">From chain</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="mono w-full bg-transparent text-xl font-medium outline-none placeholder:text-[var(--muted)]/50"
          />
          <ChainPicker
            value={fromChain}
            onSelect={(id) => setFromChain(id as BridgeChainId)}
            disabledIds={[toChain]}
          >
            {chainLabel(fromChain)}
          </ChainPicker>
        </div>
      </div>

      {/* Arrow */}
      <div className="relative z-10 -my-2.5 flex justify-center">
        <span className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs">
          ↓
        </span>
      </div>

      {/* To */}
      <div className="rounded-xl border border-[var(--border)] p-3.5">
        <label className="text-[11px] text-[var(--muted)]">To chain</label>
        <div className="mt-1 flex items-center justify-between">
          <span
            className={`mono w-full truncate text-xl font-medium ${
              estimating ? "animate-pulse opacity-50" : ""
            }`}
          >
            {estimate?.estimatedOutput?.amount ?? (amount || "0.00")}
          </span>
          <ChainPicker
            value={toChain}
            onSelect={(id) => setToChain(id as BridgeChainId)}
            disabledIds={[fromChain]}
          >
            {chainLabel(toChain)}
          </ChainPicker>
        </div>
        {fromChain === toChain && (
          <p className="mt-1.5 text-[11px] text-red-500">
            Pick two different chains.
          </p>
        )}
      </div>

      <button
        disabled={!ready || bridging}
        onClick={handleBridge}
        className="mt-4 w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--background)] transition-opacity hover:opacity-85 disabled:opacity-40"
      >
        {!ready
          ? "Enter amount & chains"
          : bridging
            ? "Bridging…"
            : `Bridge ${chainLabel(fromChain)} → ${chainLabel(toChain)}`}
      </button>

      {error && (
        <p className="mt-3 break-words rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">
          {error}
        </p>
      )}
      {txHash && (
        <p className="mt-3 text-xs">
          ✅ Bridge tx sent —{" "}
          {txHash ? (
            <a
              className="underline underline-offset-2"
              href={`${ARC_EXPLORER}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              view ↗
            </a>
          ) : (
            "check destination chain explorer"
          )}
        </p>
      )}

      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
        <TokenDot symbol="USDC" />
        Powered by Circle CCTP V2 — native burn &amp; mint, no liquidity pool
      </div>
    </section>
  );
}
