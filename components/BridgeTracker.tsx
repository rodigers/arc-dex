"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/lib/toast";
import { shortHash } from "@/lib/format";

/**
 * Live CCTP V2 bridge status tracker.
 *
 * Flow states: BURN_PENDING → ATTESTED → MINT_COMPLETE (or FAILED).
 * Polls Circle's public IRIS attestation API every 5s; when the API is
 * unreachable, falls back to elapsed-time based estimated progress
 * (Burn ~1min → Attestation ~2-10min → Mint ~2min after attestation).
 */

export type BridgeJob = {
  txHash: string;
  fromChain: string;
  toChain: string;
  createdAt: number;
};

const STORAGE_KEY = "arcswap_bridges";
const BRIDGES_EVENT = "arcswap_bridges_changed";
const MAX_JOBS = 3;

const POLL_MS = 5000;
const BURN_ESTIMATE_MS = 60_000;
/** Fallback: assume attested once this much time has elapsed (2–10 min window). */
const ATTEST_FALLBACK_MS = 360_000;
/** Mint completes roughly 1–2 min after attestation. */
const MINT_AFTER_ATTEST_MS = 120_000;
/** Give up (mark failed) after this long without an attestation. */
const FAIL_AFTER_MS = 45 * 60_000;

const IRIS_API = "https://iris-api-sandbox.circle.com/v2/messages";

/** CCTP domain ids for the bridge chains (source chain of the burn). */
export const CCTP_DOMAINS: Record<string, number> = {
  Ethereum_Sepolia: 0,
  Base_Sepolia: 6,
  Avalanche_Fuji: 1,
  Arc_Testnet: 26,
};

const EXPLORERS: Record<string, string> = {
  Ethereum_Sepolia: "https://sepolia.etherscan.io/tx/",
  Base_Sepolia: "https://sepolia.basescan.org/tx/",
  Avalanche_Fuji: "https://subnets-test.avax.network/c-chain/tx/",
  Arc_Testnet: "https://testnet.arcscan.app/tx/",
};

function loadJobs(): BridgeJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const jobs: BridgeJob[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue;
      const j = entry as Record<string, unknown>;
      if (
        typeof j.txHash === "string" &&
        typeof j.fromChain === "string" &&
        typeof j.toChain === "string" &&
        typeof j.createdAt === "number"
      ) {
        jobs.push({
          txHash: j.txHash,
          fromChain: j.fromChain,
          toChain: j.toChain,
          createdAt: j.createdAt,
        });
      }
    }
    return jobs.slice(0, MAX_JOBS);
  } catch {
    return [];
  }
}

function saveJobs(jobs: BridgeJob[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, MAX_JOBS)));
  } catch {
    // storage unavailable — tracking stays in-memory only
  }
}

/** Register a freshly submitted bridge tx so it survives refreshes. */
export function recordBridgeJob(job: Omit<BridgeJob, "createdAt">) {
  if (typeof window === "undefined") return;
  const next: BridgeJob[] = [
    { ...job, createdAt: Date.now() },
    ...loadJobs().filter((j) => j.txHash !== job.txHash),
  ].slice(0, MAX_JOBS);
  saveJobs(next);
  window.dispatchEvent(new CustomEvent(BRIDGES_EVENT));
}

type Phase = "burn" | "attested" | "minted" | "failed";

function phaseOf(
  job: BridgeJob,
  attestedAt: number | undefined,
  now: number
): Phase {
  const elapsed = now - job.createdAt;
  if (attestedAt != null) {
    return now >= attestedAt + MINT_AFTER_ATTEST_MS ? "minted" : "attested";
  }
  if (elapsed >= FAIL_AFTER_MS) return "failed";
  // No API data — fall back to elapsed-time estimates.
  if (elapsed >= ATTEST_FALLBACK_MS) return "attested";
  return "burn";
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Query Circle's IRIS API for the burn's attestation status.
 * Returns the time attestation completed, or null while pending/unreachable.
 */
async function pollAttestation(job: BridgeJob): Promise<number | null> {
  const domain = CCTP_DOMAINS[job.fromChain];
  if (domain == null) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `${IRIS_API}/${domain}?transactionHash=${encodeURIComponent(job.txHash)}`,
      { cache: "no-store", signal: controller.signal }
    );
    clearTimeout(timer);
    // 404 simply means "not indexed yet" — still pending.
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (typeof json !== "object" || json === null) return null;
    const messages = (json as { messages?: unknown }).messages;
    if (!Array.isArray(messages) || messages.length === 0) return null;
    const msg = messages[0] as Record<string, unknown>;
    // Map sourceTxHash/message fields defensively; treat any "complete"
    // status (v2 uses attestationStatus/status) as attested.
    void msg.sourceTxHash;
    void msg.message;
    const status = String(msg.attestationStatus ?? msg.status ?? "").toLowerCase();
    const attestation = msg.attestation;
    const attested =
      status.includes("complete") ||
      (typeof attestation === "string" &&
        attestation.length > 0 &&
        attestation.toLowerCase() !== "pending");
    return attested ? Date.now() : null;
  } catch {
    return null;
  }
}

const STEPS: { id: Phase; label: string }[] = [
  { id: "burn", label: "Burn" },
  { id: "attested", label: "Attested" },
  { id: "minted", label: "Mint" },
];

function StepIndicator({ phase }: { phase: Phase }) {
  const currentIdx =
    phase === "burn" ? 0 : phase === "attested" ? 1 : phase === "minted" ? 2 : -1;

  function circle(i: number) {
    const done = currentIdx > i;
    const active = currentIdx === i;
    if (phase === "failed" && i === 1) {
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          ✕
        </span>
      );
    }
    if (done || (phase === "minted" && i <= 2)) {
      return (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
          style={{
            background: "color-mix(in srgb, var(--success) 15%, transparent)",
            color: "var(--success)",
          }}
        >
          ✓
        </span>
      );
    }
    if (active) {
      return (
        <span className="relative flex h-7 w-7 items-center justify-center">
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-30"
            style={{ background: "var(--foreground)" }}
          />
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
        </span>
      );
    }
    return (
      <span className="h-7 w-7 rounded-full border border-[var(--border)]" />
    );
  }

  return (
    <ol className="flex w-full items-center px-1">
      {STEPS.map((step, i) => {
        const done = currentIdx > i || (phase !== "failed" && i === 0 && currentIdx > i);
        const lineDone = currentIdx > i;
        return (
          <li key={step.id} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1">
              {circle(i)}
              <span
                className={`text-[10px] ${
                  done || currentIdx === i
                    ? "font-medium"
                    : "text-[var(--muted)]"
                }`}
                style={
                  done ? { color: "var(--success)" } : currentIdx === i ? undefined : undefined
                }
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={`mx-1 mb-4 h-px flex-1 ${
                  lineDone ? "" : "bg-[var(--border)]"
                }`}
                style={lineDone ? { background: "var(--success)" } : undefined}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function BridgeTracker({ onComplete }: { onComplete?: () => void }) {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [jobs, setJobs] = useState<BridgeJob[]>([]);
  const [attested, setAttested] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  const toastedRef = useRef<Set<string>>(new Set());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Load persisted jobs + live-reload on changes (incl. other tabs).
  useEffect(() => {
    setMounted(true);
    setJobs(loadJobs());
    const reload = () => setJobs(loadJobs());
    window.addEventListener(BRIDGES_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(BRIDGES_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  // 1s ticker for the elapsed timers.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const jobsRef = useRef<BridgeJob[]>([]);
  jobsRef.current = jobs;

  // 5s attestation polling for in-flight jobs.
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    async function tick() {
      const pending = jobsRef.current.filter((j) => attested[j.txHash] == null);
      for (const job of pending) {
        const at = await pollAttestation(job);
        if (cancelled) return;
        if (at != null) {
          setAttested((prev) =>
            prev[job.txHash] == null ? { ...prev, [job.txHash]: at } : prev
          );
        }
      }
    }
    const t = setInterval(() => void tick(), POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, jobs]);

  // Fire completion side effects exactly once per job.
  useEffect(() => {
    if (!mounted) return;
    for (const job of jobs) {
      const key = job.txHash;
      if (toastedRef.current.has(key)) continue;
      if (phaseOf(job, attested[key], now) === "minted") {
        toastedRef.current.add(key);
        toast({ title: "Bridge complete 🎉", description: `${shortHash(job.txHash)} minted on destination` });
        onCompleteRef.current?.();
      }
    }
  }, [mounted, jobs, attested, now, toast]);

  if (!mounted || jobs.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Bridge tracker
      </div>
      {jobs.map((job) => {
        const phase = phaseOf(job, attested[job.txHash], now);
        const explorer = EXPLORERS[job.fromChain] ?? "https://testnet.arcscan.app/tx/";
        return (
          <article
            key={job.txHash}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
            aria-label={`Bridge from ${job.fromChain} to ${job.toChain}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="mono truncate text-sm font-medium">
                USDC · {job.fromChain.replace(/_/g, " ")} → {job.toChain.replace(/_/g, " ")}
              </span>
              <span className="mono shrink-0 text-xs text-[var(--muted)]">
                {formatElapsed(now - job.createdAt)}
              </span>
            </div>

            <div className="mt-3">
              <StepIndicator phase={phase} />
            </div>

            {phase === "failed" && (
              <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
                Attestation timed out — check the transaction on the source explorer.
              </p>
            )}

            <a
              href={`${explorer}${job.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono mt-2 inline-block text-xs underline-offset-2 hover:underline"
            >
              {shortHash(job.txHash)} ↗
            </a>
          </article>
        );
      })}
    </section>
  );
}
