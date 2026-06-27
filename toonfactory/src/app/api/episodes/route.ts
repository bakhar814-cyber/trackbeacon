import { prisma } from "@/lib/db";
import { json, errorJson } from "@/lib/api";
import { getOrCreateSeries } from "@/lib/story/manager";
import { startEpisodeProduction } from "@/lib/pipeline/orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/episodes — list episodes (most recent first).
export async function GET() {
  const episodes = await prisma.episode.findMany({
    orderBy: { number: "desc" },
    include: { _count: { select: { scenes: true } } },
  });
  return json({ episodes });
}

// POST /api/episodes — create the next episode and queue its production.
export async function POST() {
  try {
    const series = await getOrCreateSeries();
    const episodeId = await startEpisodeProduction(series.id);
    return json({ episodeId }, 201);
  } catch (err) {
    return errorJson(`failed to start episode: ${String(err)}`, 500);
  }
}
