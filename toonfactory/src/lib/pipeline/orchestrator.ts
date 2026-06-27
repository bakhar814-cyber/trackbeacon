import { prisma } from "../db";
import { log } from "../logger";
import { enqueue } from "../queue/queue";
import { PIPELINE_STAGES, STAGE_STATUS, type StageName } from "./stages";

import { runPlan } from "./stages/plan";
import { runScript } from "./stages/script";
import { runStoryboard } from "./stages/storyboard";
import { runImages } from "./stages/images";
import { runAnimation } from "./stages/animation";
import { runVoice } from "./stages/voice";
import { runMusic } from "./stages/music";
import { runEdit } from "./stages/edit";
import { runThumbnail } from "./stages/thumbnail";
import { runSeo } from "./stages/seo";
import { runQc } from "./stages/qc";
import { runUpload } from "./stages/upload";

export interface StageContext {
  episodeId: string;
  payload: Record<string, unknown>;
}
export type StageFn = (ctx: StageContext) => Promise<Record<string, unknown>>;

const STAGE_FNS: Record<StageName, StageFn> = {
  plan: runPlan,
  script: runScript,
  storyboard: runStoryboard,
  images: runImages,
  animation: runAnimation,
  voice: runVoice,
  music: runMusic,
  edit: runEdit,
  thumbnail: runThumbnail,
  seo: runSeo,
  qc: runQc,
  upload: runUpload,
};

export function nextStage(stage: StageName): StageName | null {
  const i = PIPELINE_STAGES.indexOf(stage);
  if (i === -1 || i === PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[i + 1];
}

// Execute one pipeline stage for an episode, advance its status, and chain the
// next stage onto the queue. Returns the stage result. The worker calls this.
export async function runStage(
  stage: string,
  ctx: StageContext,
): Promise<{ result: Record<string, unknown>; queuedNext: StageName | null }> {
  if (!(stage in STAGE_FNS)) {
    throw new Error(`Unknown pipeline stage: ${stage}`);
  }
  const name = stage as StageName;

  // Reflect the in-progress stage on the episode (best-effort).
  const status = STAGE_STATUS[name];
  await prisma.episode
    .update({ where: { id: ctx.episodeId }, data: { status: status as never } })
    .catch(() => undefined);

  await log.info(`stage:${name} started`, { scope: "pipeline", episodeId: ctx.episodeId });
  const result = await STAGE_FNS[name](ctx);
  await log.info(`stage:${name} finished`, {
    scope: "pipeline",
    episodeId: ctx.episodeId,
    meta: result,
  });

  // Chain the next stage. The final stage (upload) leaves the episode in its
  // terminal status set by the stage itself.
  const next = nextStage(name);
  if (next) {
    await enqueue({ episodeId: ctx.episodeId, stage: next, payload: {} });
  }
  return { result, queuedNext: next };
}

// Kick off production for a fresh episode: create the row and enqueue stage 1.
export async function startEpisodeProduction(seriesId: string): Promise<string> {
  const agg = await prisma.episode.aggregate({
    where: { seriesId },
    _max: { number: true },
  });
  const number = (agg._max.number ?? 0) + 1;
  const episode = await prisma.episode.create({
    data: { seriesId, number, status: "PLANNED" },
  });
  await enqueue({ episodeId: episode.id, stage: PIPELINE_STAGES[0], payload: {} });
  await log.info(`Queued production for episode #${number}`, {
    scope: "pipeline",
    episodeId: episode.id,
  });
  return episode.id;
}
