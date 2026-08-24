"use client";

import { useToasts, type ToastVariant } from "@/lib/toast";

const VARIANT_STYLES: Record<ToastVariant, { ring: string; dot: string }> = {
  success: {
    ring: "border-[var(--border)]",
    dot: "bg-emerald-500",
  },
  error: {
    ring: "border-red-300 dark:border-red-900",
    dot: "bg-red-500",
  },
};

export function ToastViewport() {
  const { toasts, dismissToast } = useToasts();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => {
        const styles = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={`animate-toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border ${styles.ring} bg-[var(--card)] p-4 shadow-lg shadow-black/5`}
          >
            <span
              aria-hidden
              className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description ? (
                <p className="mono mt-1 text-xs break-all opacity-60">
                  {t.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(t.id)}
              className="shrink-0 rounded-md p-0.5 text-sm leading-none opacity-40 transition-opacity hover:opacity-100"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
