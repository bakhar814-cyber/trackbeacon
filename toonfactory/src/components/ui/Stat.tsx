import * as React from "react";

export function Stat({
  label,
  value,
  delta,
  deltaTone = "neutral",
  hint,
  icon,
  accent = "brand",
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  hint?: string;
  icon?: React.ReactNode;
  accent?: "brand" | "accent" | "good" | "warn" | "bad";
}) {
  const accentRing: Record<string, string> = {
    brand: "from-brand/20 to-transparent text-brand-soft",
    accent: "from-accent/20 to-transparent text-accent",
    good: "from-good/20 to-transparent text-good",
    warn: "from-warn/20 to-transparent text-warn",
    bad: "from-bad/20 to-transparent text-bad",
  };
  const deltaColor =
    deltaTone === "up" ? "text-good" : deltaTone === "down" ? "text-bad" : "text-slate-400";

  return (
    <div className="card card-hover relative overflow-hidden">
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-60 blur-2xl ${accentRing[accent]}`}
      />
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {icon && (
          <span className={`relative ${accentRing[accent].split(" ").pop()}`}>{icon}</span>
        )}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-semibold tracking-tight text-white">{value}</span>
        {delta && <span className={`pb-1 text-xs font-medium ${deltaColor}`}>{delta}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
