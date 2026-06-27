"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Busy = null | "produce" | "tick";

export function ProductionActions() {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  async function produceNext() {
    setBusy("produce");
    setError(null);
    try {
      // Create the next episode, then kick off the pipeline run for it.
      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Create episode failed (${res.status})`);
      let episodeId: string | undefined;
      try {
        const json = await res.json();
        episodeId = json?.id ?? json?.episode?.id ?? json?.data?.id;
      } catch {
        /* tolerate empty body */
      }
      const runRes = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(episodeId ? { episodeId } : {}),
      });
      if (!runRes.ok) throw new Error(`Pipeline run failed (${runRes.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function runTick() {
    setBusy("tick");
    setError(null);
    try {
      const res = await fetch("/api/jobs/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Worker tick failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={produceNext}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-white shadow-glow transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "produce" ? <Spinner /> : <PlusIcon />}
          Produce next episode
        </button>
        <button
          onClick={runTick}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "tick" ? <Spinner /> : <BoltIcon />}
          Run worker tick
        </button>
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
