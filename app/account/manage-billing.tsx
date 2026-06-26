"use client";
import { useState } from "react";

export function ManageBilling() {
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setLoading(false);
  }
  return (
    <button onClick={open} disabled={loading} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
      {loading ? "…" : "Manage billing"}
    </button>
  );
}
