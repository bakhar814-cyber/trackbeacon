"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { formatPrice } from "@/lib/format";

type Row = {
  id: string;
  active: boolean;
  items: { slug: string; title: string; current_price: number | null; currency: string; in_stock: boolean } | null;
};

export function TrackersTable({ trackers }: { trackers: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(trackerId: string, action: "pause" | "resume" | "remove") {
    setBusy(trackerId);
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackerId, action }),
    });
    setBusy(null);
    router.refresh();
  }

  if (trackers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-400">
        No trackers yet. <Link href="/directory" className="text-accent underline">Browse the directory</Link> and tap “Track this”.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {trackers.map((t) => (
        <div key={t.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
          <div className="min-w-0">
            <Link href={`/item/${t.items?.slug}`} className="truncate font-medium hover:underline">
              {t.items?.title}
            </Link>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <span>{formatPrice(t.items?.current_price ?? null, t.items?.currency)}</span>
              {t.items && <StatusBadge inStock={t.items.in_stock} />}
              {!t.active && <span className="text-amber-600">paused</span>}
            </div>
          </div>
          <div className="flex shrink-0 gap-2 text-sm">
            <button
              disabled={busy === t.id}
              onClick={() => act(t.id, t.active ? "pause" : "resume")}
              className="rounded-md border border-slate-300 px-3 py-1.5"
            >
              {t.active ? "Pause" : "Resume"}
            </button>
            <button
              disabled={busy === t.id}
              onClick={() => act(t.id, "remove")}
              className="rounded-md border border-red-200 px-3 py-1.5 text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
