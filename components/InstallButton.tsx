"use client";

import { useEffect, useState } from "react";

/**
 * "Install app" button driven by the browser's beforeinstallprompt event.
 * Hidden entirely when the browser doesn't support install, the prompt was
 * dismissed, or the app is already running standalone.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "arcswap_install_dismissed";

export function InstallButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Already running as an installed app?
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // storage unavailable — keep showing
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "dismissed") {
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        // ignore
      }
    }
    setDeferred(null);
    setHidden(true);
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      className={
        className ??
        "flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs transition-colors hover:border-[var(--border-strong)]"
      }
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Install app
    </button>
  );
}
