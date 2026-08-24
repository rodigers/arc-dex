"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EIP1193Provider } from "viem";
import { getAppKit, makeAdapter } from "@/lib/appkit";
import { ARC_EXPLORER, TOKENS, type TokenSymbol } from "@/lib/tokens";
import { EURC_ADDRESS, USDC_ADDRESS, useBalances } from "@/lib/balances";
import { useToast } from "@/lib/toast";
import { SettingsPopover, DEFAULT_SETTINGS, type SwapSettings } from "@/components/SettingsPopover";
import {
  RecentSwaps,
  saveRecentSwap,
  type SwapRecord,
} from "@/components/RecentSwaps";
import { TokenBadge, TokenDot } from "@/components/TokenBadge";
import { WalletButton } from "@/components/WalletButton";
import { BridgePanel } from "@/components/BridgePanel";

type Connection = { provider: EIP1193Provider; address: string };

type QuoteState = {
  receiveAmount: string;
  minReceived: string | null;
  feePct: number | null;
};

type AdapterFor = Awaited<ReturnType<typeof makeAdapter>>;

const FAUCET_URL = "https://faucet.circle.com";
const ARC_CHAIN_ID = 5042002;

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000)
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 1)
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function balanceKey(symbol: TokenSymbol) {
  if (symbol === "NATIVE") return "NATIVE";
  if (symbol === "EURC") return EURC_ADDRESS.toLowerCase();
  return USDC_ADDRESS.toLowerCase();
}

export default function Home() {
  const { toast } = useToast();

  const [connection, setConnection] = useState<Connection | null>(null);
  const [paySymbol, setPaySymbol] = useState<TokenSymbol>("USDC");
  const [receiveSymbol, setReceiveSymbol] = useState<TokenSymbol>("EURC");
  const [payAmount, setPayAmount] = useState("");
  const [quote, setQuote] = useState<QuoteState | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [settings, setSettings] = useState<SwapSettings>(DEFAULT_SETTINGS);
  const [flipRotated, setFlipRotated] = useState(false);
  const [swapsRefreshKey, setSwapsRefreshKey] = useState(0);
  const [tab, setTab] = useState<"swap" | "bridge">("swap");

  const connRef = useRef<Connection | null>(null);
  const adapterPromiseRef = useRef<Promise<AdapterFor> | null>(null);

  const { balances, loading: balancesLoading, refetch } = useBalances(
    connection?.address ?? null
  );

  const slippageBps = Math.round(settings.slippagePct * 100);

  const handleConnected = useCallback(
    (provider: EIP1193Provider, address: string) => {
      const cur = connRef.current;
      if (cur && cur.provider === provider && cur.address === address) return;
      const next: Connection = { provider, address };
      connRef.current = next;
      queueMicrotask(() => setConnection(next));
    },
    []
  );

  useEffect(() => {
    adapterPromiseRef.current = null;
    if (connection) {
      adapterPromiseRef.current = makeAdapter(connection.provider).catch(
        (err: unknown) => {
          adapterPromiseRef.current = null;
          throw err;
        }
      );
    }
  }, [connection]);

  const getAdapter = useCallback((): Promise<AdapterFor> => {
    const p = adapterPromiseRef.current;
    if (!p) return Promise.reject(new Error("Wallet not connected"));
    return p;
  }, []);

  useEffect(() => {
    setQuote(null);
    setQuoteError(null);

    const amount = Number(payAmount);
    if (
      !connection ||
      paySymbol === receiveSymbol ||
      !payAmount ||
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setQuoting(true);
      getAdapter()
        .then((adapter) =>
          getAppKit().estimateSwap({
            from: {
              adapter,
              chain: "Arc_Testnet",
            },
            tokenIn: paySymbol,
            tokenOut: receiveSymbol,
            amountIn: payAmount,
            config: { slippageBps },
          })
        )
        .then((estimate) => {
          if (cancelled) return;
          const out = Number(estimate.estimatedOutput.amount);
          const totalFees = (estimate.fees ?? []).reduce(
            (acc, f) => acc + (f.amount !== null ? Number(f.amount) : 0),
            0
          );
          const feePct =
            Number.isFinite(totalFees) && out + totalFees > 0
              ? (totalFees / (out + totalFees)) * 100
              : null;
          setQuote({
            receiveAmount: estimate.estimatedOutput.amount,
            minReceived: estimate.stopLimit.amount,
            feePct,
          });
          setQuoting(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setQuote(null);
          setQuoteError(
            err instanceof Error ? err.message : "Failed to fetch quote"
          );
          setQuoting(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    connection,
    payAmount,
    paySymbol,
    receiveSymbol,
    slippageBps,
    getAdapter,
  ]);

  const parsedPayAmount = Number(payAmount);
  const payBalance = connection ? (balances[balanceKey(paySymbol)] ?? 0) : 0;
  const receiveBalance = connection
    ? (balances[balanceKey(receiveSymbol)] ?? 0)
    : 0;
  const insufficient =
    connection &&
    parsedPayAmount > 0 &&
    Number.isFinite(parsedPayAmount) &&
    parsedPayAmount > payBalance;

  function selectPay(symbol: TokenSymbol) {
    if (symbol === receiveSymbol) setReceiveSymbol(paySymbol);
    setPaySymbol(symbol);
  }

  function selectReceive(symbol: TokenSymbol) {
    if (symbol === paySymbol) setPaySymbol(receiveSymbol);
    setReceiveSymbol(symbol);
  }

  function flipTokens() {
    setFlipRotated((v) => !v);
    setPaySymbol(receiveSymbol);
    setReceiveSymbol(paySymbol);
  }

  function setMax() {
    setPayAmount(formatAmount(payBalance));
  }

  async function handleSwap() {
    if (!connection || insufficient) return;
    setSwapping(true);
    try {
      const adapter = await getAdapter();
      const result = await getAppKit().swap({
        from: {
          adapter,
          chain: "Arc_Testnet",
        },
        tokenIn: paySymbol,
        tokenOut: receiveSymbol,
        amountIn: payAmount,
        config: { slippageBps },
      });

      const toAmount =
        result.amountOut ?? quote?.receiveAmount ?? formatAmount(parsedPayAmount);
      toast({
        title: result.progress.status === "DONE" ? "Swap complete" : "Swap submitted",
        description: `${payAmount} ${paySymbol} → ${toAmount} ${receiveSymbol}${
          result.txHash ? ` · tx ${result.txHash.slice(0, 10)}…` : ""
        }`,
      });

      const record: SwapRecord = {
        txHash: result.txHash || "0x",
        fromSymbol: paySymbol,
        toSymbol: receiveSymbol,
        fromAmount: payAmount,
        toAmount,
        timestamp: Date.now(),
      };
      saveRecentSwap(record);
      setSwapsRefreshKey((k) => k + 1);
      setPayAmount("");
    } catch (err) {
      toast({
        variant: "error",
        title: "Swap failed",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSwapping(false);
    }
  }

  const canSwap =
    !!connection &&
    !!quote &&
    !quoting &&
    !swapping &&
    parsedPayAmount > 0 &&
    !insufficient &&
    paySymbol !== receiveSymbol;

  function swapButtonLabel() {
    if (!connection) return "Connect wallet";
    if (!payAmount || Number.isNaN(parsedPayAmount) || parsedPayAmount <= 0)
      return "Enter an amount";
    if (insufficient) return `Insufficient ${paySymbol}`;
    if (swapping) return "Swapping…";
    if (quoting) return "Fetching quote…";
    if (!quote) return "Swap";
    return "Swap";
  }

  const impactColor =
    quote?.feePct == null
      ? undefined
      : quote.feePct > 5
        ? "var(--danger)"
        : quote.feePct > 2
          ? "var(--warning)"
          : "var(--success)";

  return (
    <div className="grid-bg flex flex-1 flex-col items-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">ArcSwap</h1>
          <div className="flex items-center gap-2">
            <SettingsPopover settings={settings} onChange={setSettings} />
            <WalletButton onConnected={handleConnected} />
          </div>
        </header>

        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
            <div className="text-xs text-[var(--muted)]">Chain</div>
            <div className="mono mt-0.5 text-sm font-semibold">
              {ARC_CHAIN_ID}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
            <div className="text-xs text-[var(--muted)]">Finality</div>
            <div className="mono mt-0.5 text-sm font-semibold">&lt;1s</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
            <div className="text-xs text-[var(--muted)]">Gas</div>
            <div className="mono mt-0.5 text-sm font-semibold">USDC</div>
          </div>
        </section>

        {connection && (
          <section className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm">
            {TOKENS.map((t) => (
              <span key={t.symbol} className="flex items-center gap-1.5">
                <TokenDot symbol={t.symbol} />
                <span className="mono">{t.symbol}</span>
                <span className="mono text-xs text-[var(--muted)]">
                  {formatAmount(balances[balanceKey(t.symbol as TokenSymbol)] ?? 0)}
                </span>
              </span>
            ))}
            <button
              onClick={refetch}
              disabled={balancesLoading}
              className="ml-1 rounded-lg border border-[var(--border)] p-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
              aria-label="Refresh balances"
            >
              {balancesLoading ? "…" : "↻"}
            </button>
          </section>
        )}

        {/* Tabs */}
        <section className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
          {(
            [
              ["swap", "Swap"],
              ["bridge", "Bridge"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-[var(--accent)] text-[var(--background)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
        </section>

        <main
          className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
          hidden={tab !== "swap"}
        >
          <div className="rounded-xl border border-[var(--border)] p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-[var(--muted)]">
                <TokenDot symbol={paySymbol} />
                You pay
              </span>
              {connection && (
                <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  Balance:{" "}
                  <span className="mono">{formatAmount(payBalance)}</span>
                  <button
                    type="button"
                    onClick={setMax}
                    className="mono cursor-pointer rounded-lg border border-[var(--border)] px-1.5 py-0.5 font-semibold transition hover:border-[var(--border-strong)]"
                  >
                    MAX
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                inputMode="decimal"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="mono min-w-0 flex-1 bg-transparent text-2xl outline-none placeholder:text-[var(--muted)]"
                aria-label="Amount to pay"
              />
              <TokenBadge symbol={paySymbol} onChange={selectPay} />
            </div>
          </div>

          <div className="relative z-10 my-1 flex justify-center">
            <button
              type="button"
              aria-label="Flip tokens"
              onClick={flipTokens}
              className={`flex h-9 w-9 -translate-y-0.5 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-lg transition-transform duration-300 hover:border-[var(--border-strong)] ${
                flipRotated ? "rotate-180" : ""
              }`}
            >
              ⇅
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border)] p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-[var(--muted)]">
                <TokenDot symbol={receiveSymbol} />
                You receive
              </span>
              {connection && (
                <span className="text-xs text-[var(--muted)]">
                  Balance:{" "}
                  <span className="mono">{formatAmount(receiveBalance)}</span>
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                readOnly
                placeholder="0.00"
                value={
                  quoting
                    ? ""
                    : (quote?.receiveAmount
                        ? formatAmount(Number(quote.receiveAmount))
                        : "")
                }
                className="mono min-w-0 flex-1 bg-transparent text-2xl outline-none placeholder:text-[var(--muted)]"
                aria-label="Amount to receive"
              />
              {quoting ? (
                <span className="skeleton mono h-8 w-24 rounded-xl" />
              ) : (
                <TokenBadge symbol={receiveSymbol} onChange={selectReceive} />
              )}
            </div>
          </div>

          {(quote || quoteError || quoting) && (
            <div className="mt-3 space-y-1 px-1 text-xs">
              {quoteError ? (
                <p style={{ color: "var(--danger)" }}>{quoteError}</p>
              ) : quote ? (
                <>
                  <p className="flex justify-between">
                    <span className="text-[var(--muted)]">Rate</span>
                    <span className="mono">
                      1 {paySymbol} ≈{" "}
                      {formatAmount(
                        Number(quote.receiveAmount) / Number(payAmount)
                      )}{" "}
                      {receiveSymbol}
                    </span>
                  </p>
                  {quote.minReceived && (
                    <p className="flex justify-between">
                      <span className="text-[var(--muted)]">
                        Min. received
                      </span>
                      <span className="mono">
                        {formatAmount(Number(quote.minReceived))}{" "}
                        {receiveSymbol}
                      </span>
                    </p>
                  )}
                  <p className="flex justify-between">
                    <span className="text-[var(--muted)]">
                      Price impact ({settings.slippagePct}% max slippage)
                    </span>
                    <span className="mono" style={{ color: impactColor }}>
                      {quote.feePct == null
                        ? "—"
                        : `${quote.feePct.toFixed(2)}%`}
                    </span>
                  </p>
                </>
              ) : null}
            </div>
          )}

          {insufficient && (
            <p className="mt-3 px-1 text-xs" style={{ color: "var(--danger)" }}>
              Insufficient {paySymbol} balance.{" "}
              <a
                href={FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Get test funds at faucet.circle.com
              </a>
            </p>
          )}

          <button
            type="button"
            onClick={handleSwap}
            disabled={!canSwap}
            className="mt-3 w-full cursor-pointer rounded-xl bg-[var(--accent)] py-3 text-base font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {swapButtonLabel()}
          </button>
        </main>

        {/* Bridge tab */}
        {tab === "bridge" && (
          <BridgePanel
            connection={connection}
            getAdapter={getAdapter as () => never}
            onBridged={() => {
              refetch();
              setSwapsRefreshKey((k) => k + 1);
            }}
          />
        )}

        <RecentSwaps refreshKey={swapsRefreshKey} />

        <footer className="pb-6 text-center text-xs text-[var(--muted)]">
          <a
            href={ARC_EXPLORER}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            Arc Testnet Explorer ↗
          </a>
        </footer>
      </div>
    </div>
  );
}
