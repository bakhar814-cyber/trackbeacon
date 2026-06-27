import * as React from "react";

type Tone = "brand" | "accent" | "good" | "warn" | "bad" | "neutral" | "info";

const TONE_CLASS: Record<Tone, string> = {
  brand: "bg-brand/15 text-brand-soft ring-1 ring-inset ring-brand/25",
  accent: "bg-accent/15 text-accent ring-1 ring-inset ring-accent/25",
  good: "bg-good/15 text-good ring-1 ring-inset ring-good/25",
  warn: "bg-warn/15 text-warn ring-1 ring-inset ring-warn/25",
  bad: "bg-bad/15 text-bad ring-1 ring-inset ring-bad/25",
  info: "bg-sky-400/15 text-sky-300 ring-1 ring-inset ring-sky-400/25",
  neutral: "bg-white/5 text-slate-300 ring-1 ring-inset ring-white/10",
};

// Map EpisodeStatus -> tone. Covers all enum values from the schema.
const EPISODE_TONE: Record<string, Tone> = {
  PLANNED: "neutral",
  WRITING: "info",
  STORYBOARD: "info",
  ASSETS: "brand",
  ANIMATION: "brand",
  AUDIO: "brand",
  EDITING: "accent",
  REVIEW: "warn",
  READY: "good",
  SCHEDULED: "accent",
  PUBLISHED: "good",
  FAILED: "bad",
};

// Map JobStatus -> tone.
const JOB_TONE: Record<string, Tone> = {
  QUEUED: "neutral",
  RUNNING: "info",
  SUCCEEDED: "good",
  FAILED: "bad",
  CANCELLED: "warn",
};

// Map LogLevel -> tone.
const LOG_TONE: Record<string, Tone> = {
  DEBUG: "neutral",
  INFO: "info",
  WARN: "warn",
  ERROR: "bad",
};

const IMPACT_TONE: Record<string, Tone> = {
  low: "neutral",
  medium: "info",
  high: "brand",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={`pill ${TONE_CLASS[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  kind = "episode",
}: {
  status: string;
  kind?: "episode" | "job" | "log" | "impact";
}) {
  const map =
    kind === "job"
      ? JOB_TONE
      : kind === "log"
        ? LOG_TONE
        : kind === "impact"
          ? IMPACT_TONE
          : EPISODE_TONE;
  const tone = map[status] ?? "neutral";
  const label = kind === "impact" ? status : status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <Badge tone={tone}>
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${status === "RUNNING" ? "animate-pulse" : ""}`}
      />
      {label}
    </Badge>
  );
}
