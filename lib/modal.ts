/**
 * Shared modal backdrop behavior: locks body scroll while any modal is open.
 * Import useModalLock(open) in every modal component so background never
 * scrolls behind an overlay (the "buggy popup" feel).
 */
import { useEffect } from "react";

export function useModalLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}
