import { config } from "../config";
import { prisma } from "../db";
import { log } from "../logger";
import { ensureSeriesBootstrapped } from "./bootstrap";
import { startEpisodeProduction } from "../pipeline/orchestrator";
import { ingestAnalytics } from "../analytics/ingest";
import { runOptimization } from "../optimize/engine";

// The daily heartbeat: top the day up to EPISODES_PER_DAY new episodes, refresh
// analytics, and re-run the optimizer. Idempotent — safe to call repeatedly; it
// only starts episodes while today's count is below the quota. Used by both the
// cron endpoint and the always-on worker (so a single-box deploy needs no
// external scheduler).
export async function runDailyProduction(): Promise<{
  started: string[];
  analytics: { snapshots: number; promoted: number };
  optimization: { created: number };
}> {
  // First run on a fresh deploy creates the series + default cast automatically.
  const seriesId = await ensureSeriesBootstrapped();
  const perDay = Math.max(1, config.series.episodesPerDay);

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const startedToday = await prisma.episode.count({
    where: { seriesId, createdAt: { gte: since } },
  });

  const toStart = Math.max(0, perDay - startedToday);
  const started: string[] = [];
  for (let i = 0; i < toStart; i++) {
    started.push(await startEpisodeProduction(seriesId));
  }

  const analytics = await ingestAnalytics();
  const optimization = await runOptimization();

  if (started.length) {
    await log.info(`daily production: queued ${started.length} new episode(s)`, {
      scope: "production",
    });
  }
  return { started, analytics, optimization };
}
