import * as React from "react";
import { PIPELINE_STAGES, STAGE_LABELS, STAGE_STATUS, type StageName } from "@/lib/pipeline/stages";

// Episode status ordering for "what has been completed" derivation.
export const EPISODE_STATUS_ORDER = [
  "PLANNED",
  "WRITING",
  "STORYBOARD",
  "ASSETS",
  "ANIMATION",
  "AUDIO",
  "EDITING",
  "REVIEW",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
] as const;

function statusRank(status: string): number {
  const idx = EPISODE_STATUS_ORDER.indexOf(status as (typeof EPISODE_STATUS_ORDER)[number]);
  return idx === -1 ? -1 : idx;
}

export type StageState = "done" | "active" | "pending" | "failed";

// Derive per-stage state from the episode's current status.
export function deriveStageStates(status: string): Record<StageName, StageState> {
  const failed = status === "FAILED";
  const epRank = statusRank(status);
  const result = {} as Record<StageName, StageState>;

  for (const stage of PIPELINE_STAGES) {
    const stageTargetStatus = STAGE_STATUS[stage];
    const stageRank = statusRank(stageTargetStatus);

    if (failed) {
      // Mark everything below current known rank done is not possible; mark pending/failed simply.
      result[stage] = "failed";
      continue;
    }
    if (epRank < 0) {
      result[stage] = "pending";
    } else if (stageRank < epRank) {
      result[stage] = "done";
    } else if (stageRank === epRank) {
      // The episode currently sits at this status; the stage(s) mapping to it are active.
      result[stage] = status === "PUBLISHED" ? "done" : "active";
    } else {
      result[stage] = "pending";
    }
  }
  return result;
}

export function completedStageCount(status: string): number {
  const states = deriveStageStates(status);
  return PIPELINE_STAGES.filter((s) => states[s] === "done").length;
}

export function PipelineStrip({
  status,
  compact = false,
}: {
  status: string;
  compact?: boolean;
}) {
  const states = deriveStageStates(status);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PIPELINE_STAGES.map((stage, i) => {
        const state = states[stage];
        return (
          <React.Fragment key={stage}>
            <div className="group relative flex items-center">
              <span
                className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium ${dotClass(state)}`}
                title={STAGE_LABELS[stage]}
              >
                <StageDot state={state} />
                {!compact && <span className="hidden sm:inline">{STAGE_LABELS[stage]}</span>}
              </span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <span className={`h-px w-2 ${state === "done" ? "bg-good/40" : "bg-white/10"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function dotClass(state: StageState): string {
  switch (state) {
    case "done":
      return "bg-good/10 text-good ring-1 ring-inset ring-good/20";
    case "active":
      return "bg-brand/15 text-brand-soft ring-1 ring-inset ring-brand/30";
    case "failed":
      return "bg-bad/10 text-bad ring-1 ring-inset ring-bad/20";
    default:
      return "bg-white/5 text-slate-500 ring-1 ring-inset ring-white/10";
  }
}

export function StageDot({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (state === "failed") {
    return (
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    );
  }
  return (
    <span
      className={`h-2 w-2 rounded-full bg-current ${state === "active" ? "animate-pulse" : "opacity-50"}`}
    />
  );
}

// Vertical checklist variant for the production board.
export function StageChecklist({ status }: { status: string }) {
  const states = deriveStageStates(status);
  return (
    <ul className="space-y-1">
      {PIPELINE_STAGES.map((stage) => {
        const state = states[stage];
        return (
          <li key={stage} className="flex items-center gap-2 text-xs">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${dotClass(state)}`}>
              <StageDot state={state} />
            </span>
            <span
              className={
                state === "done"
                  ? "text-slate-400 line-through decoration-white/20"
                  : state === "active"
                    ? "font-medium text-brand-soft"
                    : state === "failed"
                      ? "text-bad"
                      : "text-slate-500"
              }
            >
              {STAGE_LABELS[stage]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
