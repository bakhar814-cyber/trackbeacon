"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { track as analytics } from "@/lib/analytics";

export function TrackButton({ itemId, tracked }: { itemId: string; tracked: boolean }) {
  const router = useRouter();
  const [isTracked, setTracked] = useState(tracked);
  const [loading, setLoading] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  async function toggle() {
    setLoading(true);
    setNeedsAuth(false);
    const res = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, action: isTracked ? "remove" : "add" }),
    });
    setLoading(false);
    if (res.status === 401) { setNeedsAuth(true); return; }
    if (res.status === 402) { router.push("/pricing"); return; }
    if (res.ok) {
      setTracked(!isTracked);
      if (!isTracked) analytics("track_added", { itemId });
      router.refresh();
    }
  }

  if (needsAuth) {
    const next = typeof window !== "undefined" ? window.location.pathname : "/";
    return (
      <a href={`/login?next=${encodeURIComponent(next)}`} className="btn-glow inline-block rounded-xl px-4 py-2 font-medium">
        Sign in to track
      </a>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`rounded-md px-4 py-2 font-medium transition ${
        isTracked
          ? "border border-white/15 bg-white/10 text-slate-200"
          : "btn-glow"
      } disabled:opacity-50`}
    >
      {loading ? "…" : isTracked ? "Tracking ✓" : "Track this"}
    </button>
  );
}
