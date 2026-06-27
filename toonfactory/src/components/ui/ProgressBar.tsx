import * as React from "react";

type Tone = "brand" | "accent" | "good" | "warn" | "bad";

const FILL: Record<Tone, string> = {
  brand: "bg-gradient-to-r from-brand to-brand-soft",
  accent: "bg-gradient-to-r from-accent to-sky-300",
  good: "bg-gradient-to-r from-good to-emerald-300",
  warn: "bg-gradient-to-r from-warn to-amber-300",
  bad: "bg-gradient-to-r from-bad to-rose-300",
};

export function ProgressBar({
  value,
  max = 100,
  tone = "brand",
  label,
  showValue = false,
  size = "md",
  className = "",
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label?: React.ReactNode;
  showValue?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const height = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="text-slate-400">{label}</span>}
          {showValue && <span className="font-medium text-slate-300">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-white/5 ${height}`}>
        <div
          className={`${height} rounded-full ${FILL[tone]} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
