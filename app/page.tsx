"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EIP1193Provider } from "viem";
import { getAppKit, makeAdapter } from "@/lib/appkit";
import {
  ARC_CHAIN_ID_HEX,
  ARC_EXPLORER,
  TOKENS,
  type TokenSymbol,
} from "@/lib/tokens";
import { tokenBalanceKey, useBalances } from "@/lib/balances";
import { switchToArc } from "@/lib/wallet";
import { useToast } from "@/lib/toast";
import { useCountUp } from "@/lib/useCountUp";
import { SettingsPopover, DEFAULT_SETTINGS, type SwapSettings } from "@/components/SettingsPopover";
import {
  RecentSwaps,
  saveRecentSwap,
  type SwapRecord,
} from "@/components/RecentSwaps";
import { TokenBadge, TokenDot } from "@/components/TokenBadge";
import { WalletButton } from "@/components/WalletButton";
import { BridgePanel } from "@/components/BridgePanel";
import { BridgeTracker } from "@/components/BridgeTracker";
import { MultiChainBalances } from "@/components/MultiChainBalances";
import { LimitOrderPanel } from "@/components/LimitOrderPanel";
import { DcaPanel } from "@/components/DcaPanel";
import { PriceAlerts } from "@/components/PriceAlerts";
import { ShareReceipt } from "@/components/ShareReceipt";
import { InstallButton } from "@/components/InstallButton";
import { ReferralCard } from "@/components/ReferralCard";
import {
  loadFeeTierBps,
  loadReferralAddress,
  saveFeeTierBps,
  saveReferralAddress,
  applyAppFee,
} from "@/lib/fees";
import { PriceChart } from "@/components/PriceChart";
import { Portfolio } from "@/components/Portfolio";
import { SwapConfirmModal } from "@/components/SwapConfirmModal";

type Connection = { provider: EIP1193Provider; address: string };

type QuoteState = {
  receiveAmount: string;
  minReceived: string | null;
  feePct: number | null;
};

type AdapterFor = Awaited<ReturnType<typeof makeAdapter>>;

const FAUCET_URL = "https://faucet.circle.com";
const ARC_CHAIN_ID = 5042002;
const PREFS_KEY = "arcswap_prefs";

function isTokenSymbol(value: unknown): value is TokenSymbol {
  return (
    typeof value === "string" &&
    TOKENS.some((t) => t.symbol === value)
  );
}

function readPrefs(): {
  paySymbol?: TokenSymbol;
  receiveSymbol?: TokenSymbol;
  slippagePct?: number;
} {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const prefs = parsed as Record<string, unknown>;
    const slippage =
      typeof prefs.slippagePct === "number" &&
      Number.isFinite(prefs.slippagePct) &&
      prefs.slippagePct >= 0.01 &&
      prefs.slippagePct <= 50
        ? prefs.slippagePct
        : undefined;
    return {
      paySymbol: isTokenSymbol(prefs.paySymbol) ? prefs.paySymbol : undefined,
      receiveSymbol: isTokenSymbol(prefs.receiveSymbol)
        ? prefs.receiveSymbol
        : undefined,
      slippagePct: slippage,
    };
  } catch {
    return {};
  }
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000)
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 1)
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function balanceKey(symbol: TokenSymbol) {
  return tokenBalanceKey(symbol);
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
  const [tab, setTab] = useState<"swap" | "bridge" | "limit" | "dca">("swap");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receipt, setReceipt] = useState<SwapRecord | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [chainId, setChainId] = useState<string | null>(null);
  const [quoteNonce, setQuoteNonce] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const connRef = useRef<Connection | null>(null);
  const adapterPromiseRef = useRef<Promise<AdapterFor> | null>(null);

  const { balances, loading: balancesLoading, refetch } = useBalances(
    connection?.address ?? null
  );

  const slippageBps = Math.round(settings.slippagePct * 100);

  // App-fee view of the current quote (display-level; protocol output unchanged).
  const feeView = quote
    ? applyAppFee(Number(quote.receiveAmount), settings.feeBps)
    : null;

  // Restore last-used tokens + slippage after mount (avoids SSR mismatch).
  useEffect(() => {
    const prefs = readPrefs();
    if (prefs.paySymbol) setPaySymbol(prefs.paySymbol);
    if (prefs.receiveSymbol) setReceiveSymbol(prefs.receiveSymbol);
    if (prefs.slippagePct != null) {
      setSettings((s) => ({ ...s, slippagePct: prefs.slippagePct! }));
    }
    setSettings((s) => ({
      ...s,
      feeBps: loadFeeTierBps(),
      referral: loadReferralAddress() ?? "",
    }));
    // Capture inbound referral links: /?ref=0x…
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^0x[0-9a-fA-F]{40}$/.test(ref)) saveReferralAddress(ref);
    } catch {
      // ignore malformed URLs
    }
  }, []);

  // Persist fee tier + referral whenever they change.
  useEffect(() => {
    saveFeeTierBps(settings.feeBps);
    saveReferralAddress(settings.referral || null);
  }, [settings.feeBps, settings.referral]);

  // Persist preferences whenever they change.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          paySymbol,
          receiveSymbol,
          slippagePct: settings.slippagePct,
        })
      );
    } catch {
      // storage unavailable — prefs simply won't persist
    }
  }, [paySymbol, receiveSymbol, settings.slippagePct]);

  // Track the connected wallet's chain and react to changes.
  useEffect(() => {
    if (!connection) {
      setChainId(null);
      return;
    }
    const provider = connection.provider;
    let cancelled = false;
    provider
      .request({ method: "eth_chainId", params: undefined })
      .then((id: unknown) => {
        if (!cancelled && typeof id === "string") setChainId(id);
      })
      .catch(() => {});
    const onChainChanged = (id: string) => setChainId(id);
    provider.on("chainChanged", onChainChanged);
    return () => {
      cancelled = true;
      provider.removeListener("chainChanged", onChainChanged);
    };
  }, [connection]);

  // Header elevation: blur + border once the page is scrolled a little.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const wrongNetwork =
    !!connection &&
    chainId != null &&
    chainId.toLowerCase() !== ARC_CHAIN_ID_HEX;

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
    quoteNonce,
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

  function openConfirm() {
    if (!canSwap) return;
    setConfirmOpen(true);
  }

  async function executeSwap() {
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
      setReceipt(record);
      setSwapsRefreshKey((k) => k + 1);
      setPayAmount("");
      setConfirmOpen(false);
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
    <div className="flex min-h-dvh flex-col px-4 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 xl:gap-6">
        {/* Header */}
        <header
          className={`sticky top-0 z-40 -mx-4 -my-3 flex items-center justify-between border-b px-4 py-3 transition-colors duration-200 ${
            scrolled
              ? "header-blur border-[var(--border)]"
              : "border-transparent"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-bold text-[var(--background)]">
              A
            </div>
            <h1 className="text-xl font-semibold tracking-tight">ArcSwap</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Chain chip — compact network status */}
            <span
              className={`mono hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] sm:flex ${
                connection && !wrongNetwork
                  ? "border-[var(--border)] text-[var(--muted)]"
                  : "border-red-500/40 text-red-500"
              }`}
              title={
                wrongNetwork
                  ? "Wrong network — switch to Arc Testnet"
                  : "Arc Testnet · gas USDC · finality <1s"
              }
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connection && !wrongNetwork ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              Arc Testnet
            </span>
            {wrongNetwork && (
              <button
                onClick={() => connection && void switchToArc(connection.provider)}
                className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Switch to Arc
              </button>
            )}
            <PriceAlerts />
            <SettingsPopover settings={settings} onChange={setSettings} />
            <WalletButton onConnected={handleConnected} />          </div>
        </header>

        {/* Swap card CENTER stage — side panels only on xl screens */}
        <div className="grid flex-1 items-start gap-5 xl:grid-cols-[minmax(280px,1fr)_minmax(0,620px)_minmax(280px,1fr)] xl:gap-6">
          {/* LEFT context column (desktop only, only when wallet connected) */}
          {connection && (
            <aside className="hidden flex-col gap-5 xl:flex xl:gap-6">
              <Portfolio balances={balances} />
            </aside>
          )}

          {/* CENTER: action first */}
          <div className={`flex w-full flex-col gap-5 ${connection ? "" : "xl:col-start-2"} xl:gap-6`}>
            {/* Tabs */}
            <section className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
              {(
                [
                  ["swap", "Swap"],
                  ["bridge", "Bridge"],
                  ["limit", "Limit"],
                  ["dca", "DCA"],
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
          className="card-hover animate-fade-up rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
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
              <TokenBadge
                symbol={paySymbol}
                onChange={selectPay}
                balances={balances}
              />
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
                    : feeView && feeView.feeAmount > 0
                      ? formatAmount(feeView.netReceive)
                      : quote?.receiveAmount
                        ? formatAmount(Number(quote.receiveAmount))
                        : ""
                }
                className="mono min-w-0 flex-1 bg-transparent text-2xl outline-none placeholder:text-[var(--muted)]"
                aria-label="Amount to receive"
              />
              {quoting ? (
                <span className="skeleton mono h-8 w-24 rounded-xl" />
              ) : (
                <TokenBadge
                  symbol={receiveSymbol}
                  onChange={selectReceive}
                  balances={balances}
                />
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
                  {feeView && feeView.feeAmount > 0 && (
                    <p className="flex justify-between">
                      <span className="text-[var(--muted)]">
                        App fee ({(settings.feeBps / 100).toFixed(2)}%)
                      </span>
                      <span className="mono">
                        −{formatAmount(feeView.feeAmount)} {receiveSymbol}
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
            onClick={openConfirm}
            disabled={!canSwap}
            className="mt-3 w-full cursor-pointer rounded-xl bg-[var(--accent)] py-3 text-base font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {swapButtonLabel()}
          </button>
        </main>

        {/* Bridge tab */}
        {tab === "bridge" && (
          <div key="bridge-balances" className="animate-fade-up">
            <MultiChainBalances address={connection?.address ?? null} />
          </div>
        )}
        {tab === "bridge" && (
          <div key="bridge-panel" className="animate-fade-up">
            <BridgePanel
              connection={connection}
              getAdapter={getAdapter as () => never}
              onBridged={() => {
                refetch();
                setSwapsRefreshKey((k) => k + 1);
              }}
            />
          </div>
        )}

        {/* Limit tab (always mounted so open orders keep being evaluated) */}
        <div hidden={tab !== "limit"} className="animate-fade-up">
          <LimitOrderPanel
            connection={connection}
            onSwapped={refetch}
          />
        </div>

        {/* DCA tab (always mounted so scheduled buys keep firing) */}
        <div hidden={tab !== "dca"} className="animate-fade-up">
          <DcaPanel
            connection={connection}
            onSwapped={refetch}
          />
        </div>

            {receipt && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-xs">
                <span className="truncate">
                  ✓ Swap complete ·{" "}
                  <span className="mono text-[var(--muted)]">
                    {receipt.fromAmount} {receipt.fromSymbol} →{" "}
                    {receipt.toAmount} {receipt.toSymbol}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReceiptOpen(true)}
                    className="cursor-pointer rounded-lg bg-[var(--accent)] px-2.5 py-1 font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-85"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setReceipt(null)}
                    className="cursor-pointer rounded-md p-0.5 leading-none text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                  >
                    ✕
                  </button>
                </span>
              </div>
            )}

            <RecentSwaps
              refreshKey={swapsRefreshKey}
              address={connection?.address ?? null}
            />

            <BridgeTracker onComplete={refetch} />
          </div>

          {/* RIGHT context column */}
          <aside className="flex flex-col gap-5 xl:gap-6">
            {tab === "swap" && <PriceChart />}
            <Portfolio balances={balances} connected={!!connection} />
            <ReferralCard address={connection?.address ?? null} />
          </aside>
        </div>

        <footer className="flex flex-col items-center gap-2 pb-2 text-center text-xs text-[var(--muted)]">
          <div>
            Arc Testnet · chain 5042002 · gas USDC ·{" "}
            <a
              href={ARC_EXPLORER}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              Explorer ↗
            </a>
          </div>
          <InstallButton />
        </footer>
      </div>

      <SwapConfirmModal
        open={confirmOpen}
        paySymbol={paySymbol}
        receiveSymbol={receiveSymbol}
        payAmount={payAmount}
        quote={quote}
        slippagePct={settings.slippagePct}
        deadlineMinutes={settings.deadlineMinutes}
        busy={swapping}
        getAdapter={getAdapter}
        onConfirm={() => void executeSwap()}
        onClose={() => setConfirmOpen(false)}
      />

      <ShareReceipt
        record={receiptOpen ? receipt : null}
        onClose={() => setReceiptOpen(false)}
      />
    </div>
  );
}
