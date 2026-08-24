import type { ReactNode } from "react";

/**
 * Minimal monochrome empty state: a line-art icon in a bordered
 * chip plus one explanatory sentence. `compact` fits small surfaces
 * like popovers; default sizing fits full cards.
 */
export function EmptyState({
  icon,
  children,
  compact = false,
}: {
  icon: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "gap-2 py-2" : "gap-3 py-10"
      }`}
    >
      <span
        aria-hidden
        className={`flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] ${
          compact ? "h-9 w-9" : "h-11 w-11"
        }`}
      >
        {icon}
      </span>
      <p
        className={`text-[var(--muted)] ${
          compact ? "text-xs" : "max-w-xs text-sm"
        }`}
      >
        {children}
      </p>
    </div>
  );
}
