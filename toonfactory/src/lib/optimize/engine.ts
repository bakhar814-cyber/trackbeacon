import { prisma } from "../db";

// CONTINUOUS IMPROVEMENT — mine analytics to learn what works and persist
// concrete recommendations the production pipeline can act on next time.

export async function runOptimization(): Promise<{ created: number }> {
  const episodes = await prisma.episode.findMany({
    where: { status: "PUBLISHED" },
    include: {
      analytics: { orderBy: { capturedAt: "desc" }, take: 1 },
      thumbnails: true,
    },
  });

  if (episodes.length < 2) return { created: 0 };

  // Attach the latest metric snapshot to each episode.
  const rows = episodes
    .map((e) => ({ e, m: e.analytics[0] }))
    .filter((r) => r.m);

  const recs: Array<{ area: string; title: string; detail: string; impact: string }> = [];

  // Best title pattern (by CTR).
  const byCtr = [...rows].sort((a, b) => b.m!.ctr - a.m!.ctr);
  if (byCtr[0]) {
    recs.push({
      area: "titles",
      title: `Lean into the title style of "${byCtr[0].e.title}"`,
      detail: `It has the highest CTR (${(byCtr[0].m!.ctr * 100).toFixed(1)}%). Mirror its structure — curiosity + a character name — in upcoming titles.`,
      impact: "high",
    });
  }

  // Best thumbnail (by chosen thumbnail score on the top CTR episode).
  const topThumb = byCtr[0]?.e.thumbnails.sort((a, b) => b.score - a.score)[0];
  if (topThumb) {
    recs.push({
      area: "thumbnails",
      title: "Replicate the winning thumbnail formula",
      detail: `Top thumbnail scored ${topThumb.score}. Keep big emotional close-ups, bright contrast, and 1–3 word text.`,
      impact: "high",
    });
  }

  // Pacing / retention.
  const byRet = [...rows].sort((a, b) => b.m!.avgViewPct - a.m!.avgViewPct);
  const avgRet = rows.reduce((a, r) => a + r.m!.avgViewPct, 0) / rows.length;
  if (avgRet < 0.45) {
    recs.push({
      area: "pacing",
      title: "Tighten the first 30 seconds",
      detail: `Average retention is ${(avgRet * 100).toFixed(0)}%. Open scenes faster and move the hook earlier; "${byRet[0]?.e.title}" retains best — study its opening.`,
      impact: "medium",
    });
  }

  // Length.
  const lens = rows.map((r) => ({ sec: r.e.targetSeconds, ret: r.m!.avgViewPct }));
  const longer = lens.filter((l) => l.sec > 840);
  const shorter = lens.filter((l) => l.sec <= 840);
  if (longer.length && shorter.length) {
    const lr = longer.reduce((a, l) => a + l.ret, 0) / longer.length;
    const sr = shorter.reduce((a, l) => a + l.ret, 0) / shorter.length;
    recs.push({
      area: "length",
      title: sr > lr ? "Shorter episodes retain better" : "Longer episodes are working",
      detail:
        sr > lr
          ? "Episodes under 14 min hold attention better — trim slow scenes."
          : "Full 15-min episodes retain well — keep the format.",
      impact: "low",
    });
  }

  // Posting schedule (best hour by views).
  const byHour = new Map<number, number[]>();
  for (const r of rows) {
    if (!r.e.publishedAt) continue;
    const h = r.e.publishedAt.getHours();
    byHour.set(h, [...(byHour.get(h) ?? []), r.m!.views]);
  }
  let bestHour = -1;
  let bestAvg = -1;
  for (const [h, v] of byHour) {
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestHour = h;
    }
  }
  if (bestHour >= 0) {
    recs.push({
      area: "schedule",
      title: `Publish around ${String(bestHour).padStart(2, "0")}:00`,
      detail: `Episodes posted near ${bestHour}:00 average the most views. Bias your two daily slots toward this window.`,
      impact: "medium",
    });
  }

  // Refresh the recommendation set (replace previous auto recs).
  await prisma.recommendation.deleteMany({ where: { applied: false } });
  if (recs.length) {
    await prisma.recommendation.createMany({ data: recs });
  }

  return { created: recs.length };
}
