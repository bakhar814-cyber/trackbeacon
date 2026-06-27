import type { PricePoint } from "@/lib/types";

/**
 * Dependency-free SVG sparkline of price history. (Swap for recharts later if
 * you want tooltips/axes — kept lightweight here to avoid extra deps.)
 */
export function PriceChart({ points }: { points: PricePoint[] }) {
  const data = points.filter((p) => p.price != null) as Required<PricePoint>[];
  if (data.length < 2) {
    return <p className="text-sm text-slate-400">Not enough history yet.</p>;
  }
  const w = 480;
  const h = 120;
  const prices = data.map((d) => d.price!);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const step = w / (data.length - 1);
  const path = data
    .map((d, i) => {
      const x = i * step;
      const y = h - ((d.price! - min) / span) * (h - 10) - 5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Price history">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="url(#spark)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
