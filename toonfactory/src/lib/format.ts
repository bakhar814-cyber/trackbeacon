// Display formatting helpers shared across the dashboard UI.

/** Format a USD amount (accepts a regular dollar number). */
export function formatUsd(usd: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(usd)) usd = 0;
  if (opts?.compact && Math.abs(usd) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(usd);
  }
  const fractionDigits = Math.abs(usd) < 100 ? 2 : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(usd);
}

/** Convenience for the schema's micro-dollar integers. */
export function formatMicroUsd(micro: number, opts?: { compact?: boolean }): string {
  return formatUsd((micro ?? 0) / 1_000_000, opts);
}

/** Format an integer/float count with thousands separators or compact notation. */
export function formatNumber(n: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(n)) n = 0;
  if (opts?.compact) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

/**
 * Format a percentage. Pass `fraction: true` when the value is 0..1
 * (e.g. ctr / retention); otherwise it is treated as already 0..100.
 */
export function formatPct(value: number, opts?: { fraction?: boolean; digits?: number }): string {
  if (!Number.isFinite(value)) value = 0;
  const pct = opts?.fraction ? value * 100 : value;
  const digits = opts?.digits ?? 1;
  return `${pct.toFixed(digits)}%`;
}

/** Format a duration given in seconds as e.g. "15m 00s" or "1h 02m". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/** Relative "time ago" string. Accepts Date | string | null. */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  if (!Number.isFinite(ms)) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 0) {
    // Future date (e.g. scheduled): show short forward distance.
    return `in ${humanize(-sec)}`;
  }
  if (sec < 5) return "just now";
  return `${humanize(sec)} ago`;
}

function humanize(sec: number): string {
  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.345, "w"],
    [12, "mo"],
    [Number.POSITIVE_INFINITY, "y"],
  ];
  let value = sec;
  let unit = "s";
  for (let i = 0; i < units.length; i++) {
    const [size, label] = units[i];
    unit = label;
    if (value < size) break;
    value = value / size;
  }
  return `${Math.max(1, Math.round(value))}${unit}`;
}

/** Short absolute date e.g. "Jun 27, 2026". */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Date + time e.g. "Jun 27, 14:05". */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
