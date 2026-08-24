"use client";

import { useState } from "react";
import type { EIP1193Provider } from "viem";
import { useWallet } from "@/lib/useWallet";

export function WalletButton({
  onConnected,
}: {
  onConnected: (provider: EIP1193Provider, address: string) => void;
}) {
  const { wallets, state, connecting, error, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);

  if (state) {
    onConnected(state.provider, state.address);
    return (
      <button
        onClick={disconnect}
        className="mono rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors"
      >
        {state.address.slice(0, 6)}…{state.address.slice(-4)}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-80"
      >
        Connect wallet
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-base font-semibold">Select wallet</h2>
            {wallets.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                No wallets detected. Install MetaMask or another browser wallet.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {wallets.map((w) => (
                <button
                  key={w.info.uuid}
                  disabled={connecting}
                  onClick={async () => {
                    await connect(w);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3 text-left text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                >
                  {w.info.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.info.icon} alt="" className="h-6 w-6" />
                  )}
                  {w.info.name}
                </button>
              ))}
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-500">{error}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
