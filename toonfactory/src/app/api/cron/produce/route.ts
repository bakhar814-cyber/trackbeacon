import { config } from "@/lib/config";
import { json, errorJson, requireCronSecret } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getOrCreateSeries } from "@/lib/story/manager";
import { startEpisodeProduction } from "@/lib/pipeline/orchestrator";
import { tick } from "@/lib/queue/runner";
import { ingestAnalytics } from "@/lib/analytics/ingest";
import { runOptimization } from "@/lib/optimize/engine";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/cron/produce — the daily heartbeat. Queues the day's episodes,
// advances the queue, refreshes analytics, and re-runs the optimizer.
// Secured by the x-cron-secret header. Invoked by GitHub Actions / Vercel Cron.
export async function POST(req: Request) {
  const unauth = requireCronSecret(req);
  if (unauth) return unauth;

  try {
    const series = await getOrCreateSeries();
    const perDay = Math.max(1, config.series.episodesPerDay);

    // Avoid double-queueing: only top up to perDay episodes started today.
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const startedToday = await prisma.episode.count({
      where: { seriesId: series.id, createdAt: { gte: since } },
    });

    const toStart = Math.max(0, perDay - startedToday);
    const started: string[] = [];
    for (let i = 0; i < toStart; i++) {
      started.push(await startEpisodeProduction(series.id));
    }

    // Advance the queue a few batches (the worker continues the rest).
    let processed = 0;
    for (let i = 0; i < 8; i++) {
      const r = await tick(`cron-${Date.now()}`, 5);
      processed += r.processed;
      if (r.processed === 0) break;
    }

    const analytics = await ingestAnalytics();
    const optimization = await runOptimization();

    await log.info(
      `cron: started ${started.length}, processed ${processed} jobs`,
      { scope: "cron" },
    );

    return json({ started, processed, analytics, optimization });
  } catch (err) {
    return errorJson(`cron failed: ${String(err)}`, 500);
  }
}

// Allow manual GET trigger with ?secret= for convenience.
export async function GET(req: Request) {
  return POST(req);
}
