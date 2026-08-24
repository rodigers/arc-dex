"use client";

import { useEffect, useRef } from "react";
import type { SwapRecord } from "@/components/RecentSwaps";
import { tokenMeta } from "@/lib/tokens";
import { formatAmount, shortHash } from "@/lib/format";
import { useToast } from "@/lib/toast";

/**
 * Post-swap shareable receipt: styled DOM card + decorative canvas pattern,
 * plus a hand-drawn <canvas> PNG download (no external libs).
 */

function buildSummary(record: SwapRecord): string {
  const payMeta = tokenMeta(record.fromSymbol);
  const receiveMeta = tokenMeta(record.toSymbol);
  const rate =
    Number(record.fromAmount) > 0
      ? Number(record.toAmount) / Number(record.fromAmount)
      : 0;
  return [
    "ArcSwap — swap receipt",
    `${formatAmount(Number(record.fromAmount))} ${payMeta.displaySymbol} → ${formatAmount(Number(record.toAmount))} ${receiveMeta.displaySymbol}`,
    rate > 0 ? `Rate: 1 ${record.fromSymbol} ≈ ${formatAmount(rate)} ${record.toSymbol}` : "",
    `Tx: ${record.txHash}`,
    `Time: ${new Date(record.timestamp).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  // Decorative dot grid with an "A" stamp in the middle.
  ctx.save();
  ctx.fillStyle = color;
  const step = 10;
  for (let dx = step / 2; dx < size; dx += step) {
    for (let dy = step / 2; dy < size; dy += step) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.font = "bold 28px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", x + size / 2, y + size / 2);
  ctx.restore();
}

function drawReceiptCanvas(record: SwapRecord): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const scale = 2;
  const W = 480;
  const H = 360;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  const ink = "#111111";
  const muted = "#71717a";
  const payMeta = tokenMeta(record.fromSymbol);
  const receiveMeta = tokenMeta(record.toSymbol);
  const rate =
    Number(record.fromAmount) > 0
      ? Number(record.toAmount) / Number(record.fromAmount)
      : 0;

  // Background + border
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, W - 24, H - 24);

  // Branding
  ctx.fillStyle = ink;
  ctx.fillRect(32, 32, 36, 36);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A", 50, 51);

  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.font = "bold 24px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("ArcSwap", 84, 52);
  ctx.fillStyle = muted;
  ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("Swap receipt", 84, 70);

  // Divider
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 92);
  ctx.lineTo(W - 32, 92);
  ctx.stroke();

  // Pay → receive
  ctx.fillStyle = muted;
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText("YOU PAID", 32, 118);
  ctx.fillText("YOU RECEIVED", W - 32 - 160, 118);
  ctx.fillStyle = ink;
  ctx.font = "bold 20px ui-monospace, monospace";
  ctx.fillText(
    `${formatAmount(Number(record.fromAmount))} ${payMeta.displaySymbol}`,
    32,
    142
  );
  ctx.textAlign = "right";
  ctx.fillText(
    `${formatAmount(Number(record.toAmount))} ${receiveMeta.displaySymbol}`,
    W - 32,
    142
  );
  ctx.textAlign = "left";

  // Rate
  ctx.fillStyle = muted;
  ctx.font = "13px ui-monospace, monospace";
  if (rate > 0) {
    ctx.fillText(
      `Rate  1 ${record.fromSymbol} ≈ ${formatAmount(rate)} ${record.toSymbol}`,
      32,
      176
    );
  }

  // Tx + time
  ctx.fillText(`Tx     ${shortHash(record.txHash)}`, 32, 198);
  ctx.fillText(
    `Time   ${new Date(record.timestamp).toLocaleString()}`,
    32,
    220
  );

  // Decorative pattern
  drawPattern(ctx, W - 32 - 72, H - 32 - 88, 72, "rgba(0,0,0,0.25)");

  // Footer
  ctx.fillStyle = muted;
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("Powered by Circle CCTP · testnet.arcscan.app", 32, H - 32);

  return canvas;
}

export function ShareReceipt({
  record,
  onClose,
}: {
  record: SwapRecord | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const patternRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!record) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [record, onClose]);

  // Draw the decorative pattern on the visible card.
  useEffect(() => {
    if (!record) return;
    const canvas = patternRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 72 * dpr;
    canvas.height = 72 * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 72, 72);
    drawPattern(ctx, 0, 0, 72, "rgba(0,0,0,0.3)");
  }, [record]);

  if (!record) return null;

  const payMeta = tokenMeta(record.fromSymbol);
  const receiveMeta = tokenMeta(record.toSymbol);
  const rate =
    Number(record.fromAmount) > 0
      ? Number(record.toAmount) / Number(record.fromAmount)
      : 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildSummary(record!));
      toast({ title: "Receipt copied to clipboard" });
    } catch {
      toast({ variant: "error", title: "Could not access clipboard" });
    }
  }

  function download() {
    try {
      const canvas = drawReceiptCanvas(record!);
      canvas.toBlob((blob) => {
        if (!blob) {
          toast({ variant: "error", title: "Could not generate PNG" });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `arcswap-receipt-${shortHash(record!.txHash).replace(/…/, "")}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: "Receipt saved as PNG" });
      }, "image/png");
    } catch {
      toast({ variant: "error", title: "Could not generate PNG" });
    }
  }

  return (
    <div
      className="animate-pop-in fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Swap receipt"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--background)] p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Swap receipt</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-sm leading-none text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </div>

        {/* Receipt card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-bold text-[var(--accent-foreground)]">
                A
              </span>
              <div>
                <div className="text-sm font-semibold">ArcSwap</div>
                <div className="text-[10px] text-[var(--muted)]">Swap receipt</div>
              </div>
            </div>
            <canvas
              ref={patternRef}
              className="h-[72px] w-[72px] opacity-70"
              aria-hidden
            />
          </div>

          <div className="mt-3 space-y-1.5 text-sm">
            <p className="mono flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">You paid</span>
              <span className="font-semibold">
                {formatAmount(Number(record.fromAmount))}{" "}
                {payMeta.displaySymbol}
              </span>
            </p>
            <p className="mono flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">You received</span>
              <span className="font-semibold">
                {formatAmount(Number(record.toAmount))}{" "}
                {receiveMeta.displaySymbol}
              </span>
            </p>
            {rate > 0 && (
              <p className="mono flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">Rate</span>
                <span>
                  1 {record.fromSymbol} ≈ {formatAmount(rate)}{" "}
                  {record.toSymbol}
                </span>
              </p>
            )}
            <p className="mono flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">Tx</span>
              <span>{shortHash(record.txHash)}</span>
            </p>
            <p className="mono flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">Time</span>
              <span>{new Date(record.timestamp).toLocaleString()}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="cursor-pointer rounded-xl border border-[var(--border)] py-2.5 text-sm transition-colors hover:border-[var(--border-strong)]"
          >
            Copy summary
          </button>
          <button
            type="button"
            onClick={download}
            className="cursor-pointer rounded-xl bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-85"
          >
            Download PNG
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full cursor-pointer rounded-xl py-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
