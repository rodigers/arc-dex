"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number from its previous value to `target` over `durationMs`
 * using requestAnimationFrame (ease-out cubic). Returns the current frame
 * value — re-render on every frame while animating.
 */
export function useCountUp(target: number, durationMs = 300): number {
  const [displayed, setDisplayed] = useState(() =>
    Number.isFinite(target) ? target : 0
  );
  const displayedRef = useRef(displayed);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const from = displayedRef.current;
    if (from === target) return;

    if (durationMs <= 0) {
      displayedRef.current = target;
      setDisplayed(target);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      displayedRef.current = value;
      setDisplayed(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return displayed;
}
