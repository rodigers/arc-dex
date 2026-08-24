"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/lib/toast";
import { shortHash } from "@/lib/format";

/**
 * Referral card: shows the user's shareable link (?ref=<address>) once a
 * wallet is connected, with copy + native share support.
 */

export function ReferralCard({
  address,
}: {
  address: string | null;
}) {
  const { toast } = useToast();
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    if (!address || typeof window === "undefined") {
      setLink(null);
      return;
    }
    try {
      const url = new URL(window.location.origin);
      url.searchParams.set("ref", address);
      setLink(url.toString());
    } catch {
      setLink(null);
    }
  }, [address]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Referral link copied" });
    } catch {
      toast({ variant: "error", title: "Could not access clipboard" });
    }
  }

  async function share() {
    if (!link) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "ArcSwap",
          text: "Swap stablecoins on Arc Testnet:",
          url: link,
        });
      } else {
        await copy();
      }
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted)]">
          Refer &amp; earn
        </span>
        <span className="mono rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
          10% fee share
        </span>
      </div>

      {address && link ? (
        <>
          <p className="mt-2 text-sm leading-snug">
            Share your link — you earn 10% of app fees from every swap your
            invites make.
          </p>
          <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <span className="mono min-w-0 flex-1 truncate text-xs">
              {shortHash(address)}
            </span>
            <button
              type="button"
              onClick={() => void copy()}
              className="shrink-0 cursor-pointer rounded-lg border border-[var(--border)] px-2 py-1 text-xs transition-colors hover:border-[var(--border-strong)]"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => void share()}
              className="shrink-0 cursor-pointer rounded-lg bg-[var(--accent)] px-2 py-1 text-xs font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-85"
            >
              Share
            </button>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm leading-snug text-[var(--muted)]">
          Connect a wallet to get your personal referral link and start
          earning a share of app fees.
        </p>
      )}
    </section>
  );
}
