import { prisma } from "@/lib/db";
import { json } from "@/lib/api";
import { getMonetizationStatus } from "@/lib/monetization/estimate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/analytics/summary — channel KPIs for the dashboard/Overview.
export async function GET() {
  const [latestChannel, snaps, episodeCounts, costAgg, monetization] = await Promise.all([
    prisma.channelStat.findFirst({ orderBy: { capturedAt: "desc" } }),
    prisma.analyticsSnapshot.findMany({ orderBy: { capturedAt: "desc" }, take: 60 }),
    prisma.episode.groupBy({ by: ["status"], _count: true }),
    prisma.episode.aggregate({ _sum: { costMicroUsd: true } }),
    getMonetizationStatus(),
  ]);

  const totalRevenue = snaps.reduce((a, s) => a + s.revenueUsd, 0);
  const counts: Record<string, number> = {};
  for (const c of episodeCounts) counts[c.status] = c._count;

  return json({
    channel: latestChannel,
    episodeCounts: counts,
    totalCostUsd: (costAgg._sum.costMicroUsd ?? 0) / 1_000_000,
    totalRevenueUsd: totalRevenue,
    monetization,
  });
}
