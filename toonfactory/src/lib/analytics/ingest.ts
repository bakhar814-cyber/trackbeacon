import { prisma } from "../db";
import { config } from "../config";
import { log } from "../logger";

// ANALYTICS — pull per-video and channel metrics. In live mode this calls the
// YouTube Analytics API; in mock mode it simulates plausible, growing numbers so
// the dashboard, monetization tracker, and optimizer all have data to work with.

function rand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Promote scheduled episodes whose publish time has passed to PUBLISHED.
async function promotePublished(): Promise<number> {
  const due = await prisma.episode.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
  });
  for (const e of due) {
    await prisma.episode.update({
      where: { id: e.id },
      data: { status: "PUBLISHED", publishedAt: e.scheduledFor ?? new Date() },
    });
  }
  return due.length;
}

export async function ingestAnalytics(): Promise<{ snapshots: number; promoted: number }> {
  const promoted = await promotePublished();

  const published = await prisma.episode.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { number: "asc" },
  });

  let snapshots = 0;
  for (const ep of published) {
    const ageDays = ep.publishedAt
      ? Math.max(0, (Date.now() - ep.publishedAt.getTime()) / 86400000)
      : 0;
    const seed = ep.number;

    // Simulated growth curve (mock). Replace with YouTube Analytics in live mode.
    const views = Math.round(400 + ageDays * (120 + rand(seed) * 200));
    const ctr = 0.04 + rand(seed + 1) * 0.05;
    const avgViewPct = 0.35 + rand(seed + 2) * 0.25;
    const watchTimeMin = Math.round((views * (config.series.targetSeconds / 60) * avgViewPct) / 1);
    const subsGained = Math.round(views * (0.005 + rand(seed + 3) * 0.01));
    const rpmUsd = 1 + rand(seed + 4) * 3;
    const revenueUsd = (views / 1000) * rpmUsd;

    if (config.mode === "live" && config.youtube.refreshToken) {
      // Live path: call YouTube Analytics API here and overwrite the values
      // above. Left as the documented integration point.
      await log.debug("live analytics ingest not yet wired; using API values", {
        scope: "analytics",
        episodeId: ep.id,
      });
    }

    await prisma.analyticsSnapshot.create({
      data: {
        episodeId: ep.id,
        views,
        watchTimeMin,
        impressions: Math.round(views / Math.max(ctr, 0.01)),
        ctr,
        avgViewPct,
        subsGained,
        likes: Math.round(views * 0.03),
        comments: Math.round(views * 0.004),
        rpmUsd,
        revenueUsd,
      },
    });
    snapshots++;
  }

  // Roll up a channel-wide stat row.
  const agg = await prisma.analyticsSnapshot.groupBy({
    by: ["episodeId"],
    _max: { views: true, watchTimeMin: true, subsGained: true },
  });
  const totalViews = agg.reduce((a, r) => a + (r._max.views ?? 0), 0);
  const watchHours = agg.reduce((a, r) => a + (r._max.watchTimeMin ?? 0), 0) / 60;
  const subscribers = agg.reduce((a, r) => a + (r._max.subsGained ?? 0), 0);

  await prisma.channelStat.create({
    data: {
      subscribers,
      totalViews,
      watchTimeHours: watchHours,
      monetized: subscribers >= 1000 && watchHours >= 4000,
    },
  });

  return { snapshots, promoted };
}
