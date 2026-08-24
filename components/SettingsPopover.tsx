"use client";

import { useEffect, useRef, useState } from "react";

export type SwapSettings = {
  slippagePct: number;
  deadlineMinutes: number;
};

const SLIPPAGE_PRESETS = [0.1, 0.5, 1];

export const DEFAULT_SETTINGS: SwapSettings = {
  slippagePct: 0.5,
  deadlineMinutes: 20,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function SettingsPopover({
  settings,
  onChange,
}: {
  settings: SwapSettings;
  onChange: (s: SwapSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [slippageText, setSlippageText] = useState(
    String(settings.slippagePct)
  );

  useEffect(() => {
    setSlippageText(String(settings.slippagePct));
  }, [settings.slippagePct]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isPreset = SLIPPAGE_PRESETS.includes(settings.slippagePct);

  const commitCustom = () => {
    const raw = parseFloat(slippageText);
    if (Number.isNaN(raw)) {
      setSlippageText(String(settings.slippagePct));
      return;
    }
    const clamped = clamp(raw, 0.01, 50);
    onChange({ ...settings, slippagePct: clamped });
    setSlippageText(String(clamped));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Swap settings"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        ⚙
      </button>

      {open && (
        <div className="animate-pop-in absolute right-0 top-11 z-50 w-72 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
          <div className="mb-3 text-sm font-semibold">Slippage tolerance</div>
          <div className="mb-2 flex gap-2">
            {SLIPPAGE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange({ ...settings, slippagePct: p })}
                className={`mono flex-1 rounded-lg border px-2 py-1.5 text-sm transition ${
                  settings.slippagePct === p
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                {p}%
              </button>
            ))}
            <div
              className={`mono flex flex-1 items-center rounded-lg border px-2 py-1.5 text-sm ${
                isPreset ? "border-[var(--border)]" : "border-[var(--accent)]"
              }`}
            >
              <input
                inputMode="decimal"
                value={slippageText}
                onChange={(e) => setSlippageText(e.target.value)}
                onBlur={commitCustom}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitCustom();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full min-w-0 bg-transparent outline-none"
                aria-label="Custom slippage percent"
              />
              %
            </div>
          </div>
          {(settings.slippagePct < 0.01 || settings.slippagePct > 5) && (
            <p className="mb-2 text-xs" style={{ color: "var(--warning)" }}>
              {settings.slippagePct > 5
                ? "High slippage — your trade may be front-run."
                : "Slippage too low — transaction may fail."}
            </p>
          )}

          <div className="mt-4 mb-1.5 text-sm font-semibold">
            Transaction deadline
          </div>
          <div className="mono flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            <input
              type="number"
              min={1}
              max={180}
              value={settings.deadlineMinutes}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) {
                  onChange({
                    ...settings,
                    deadlineMinutes: clamp(v, 1, 180),
                  });
                }
              }}
              className="w-full bg-transparent outline-none"
              aria-label="Deadline minutes"
            />
            <span className="text-[var(--muted)]">min</span>
          </div>
        </div>
      )}
    </div>
  );
}
