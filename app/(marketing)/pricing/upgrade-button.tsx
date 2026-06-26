"use client";
import { useState } from "react";
import { track } from "@/lib/analytics";

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    track("upgrade_clicked");
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const { url, error } = await res.json();
    if (url) window.location.href = url;
    else { alert(error || "Could not start checkout"); setLoading(false); }
  }
  return (
    <button onClick={go} disabled={loading} className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-50">
      {loading ? "…" : "Upgrade to Pro"}
    </button>
  );
}
