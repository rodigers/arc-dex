"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastVariant = "success" | "error";

export type ToastItem = {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
};

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

export type ToastContextValue = {
  toasts: readonly ToastItem[];
  pushToast: (input: ToastInput) => number;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (input: ToastInput): number => {
      const id = ++idRef.current;
      setToasts((prev) => [
        ...prev,
        {
          id,
          title: input.title,
          description: input.description,
          variant: input.variant ?? "success",
        },
      ]);
      timersRef.current.set(
        id,
        setTimeout(() => {
          timersRef.current.delete(id);
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, AUTO_DISMISS_MS)
      );
      return id;
    },
    []
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ toasts, pushToast, dismissToast }),
    [toasts, pushToast, dismissToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within a ToastProvider");
  return ctx;
}

export function useToast() {
  const { pushToast } = useToasts();
  return useMemo(
    () => ({
      toast: (input: ToastInput) => {
        pushToast(input);
      },
    }),
    [pushToast]
  );
}
