"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { formatDateTime, timeAgo } from "@/lib/format";

export type LogRow = {
  id: string;
  level: string;
  scope: string;
  message: string;
  createdAt: string; // ISO
};

const LEVELS = ["ALL", "DEBUG", "INFO", "WARN", "ERROR"] as const;

export function LogViewer({ logs }: { logs: LogRow[] }) {
  const [filter, setFilter] = useState<(typeof LEVELS)[number]>("ALL");

  const filtered = filter === "ALL" ? logs : logs.filter((l) => l.level === filter);

  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.level] = (acc[l.level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {LEVELS.map((lvl) => {
          const active = filter === lvl;
          const count = lvl === "ALL" ? logs.length : counts[lvl] ?? 0;
          return (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`pill transition ${
                active
                  ? "bg-brand/20 text-brand-soft ring-1 ring-inset ring-brand/30"
                  : "bg-white/5 text-slate-400 ring-1 ring-inset ring-white/10 hover:text-slate-200"
              }`}
            >
              {lvl === "ALL" ? "All" : lvl.charAt(0) + lvl.slice(1).toLowerCase()}
              <span className="text-[10px] opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No log entries" hint="Pipeline activity will appear here." />
      ) : (
        <div className="divide-y divide-white/5">
          {filtered.map((log) => (
            <div key={log.id} className="flex items-start gap-3 py-2.5 text-sm">
              <div className="w-20 shrink-0 pt-0.5">
                <StatusBadge status={log.level} kind="log" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-slate-200">{log.message}</p>
                {log.scope && (
                  <span className="mt-0.5 inline-block font-mono text-[11px] text-slate-500">
                    {log.scope}
                  </span>
                )}
              </div>
              <div
                className="shrink-0 whitespace-nowrap pt-0.5 text-xs text-slate-500"
                title={formatDateTime(log.createdAt)}
              >
                {timeAgo(log.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
