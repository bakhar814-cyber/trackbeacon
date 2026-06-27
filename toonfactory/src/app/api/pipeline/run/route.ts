import { prisma } from "@/lib/db";
import { json, errorJson } from "@/lib/api";
import { tick } from "@/lib/queue/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/pipeline/run { episodeId } — drive a single episode through every
// remaining stage by ticking until its queue drains (bounded). Convenient for
// demos; production uses the always-on worker instead.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { episodeId?: string };
    const episodeId = body.episodeId;
    if (!episodeId) return errorJson("episodeId required", 400);

    let iterations = 0;
    // 12 stages + retries headroom.
    while (iterations < 40) {
      const pending = await prisma.job.count({
        where: { episodeId, status: { in: ["QUEUED", "RUNNING"] } },
      });
      if (pending === 0) break;
      await tick(`run-${episodeId}`, 3);
      iterations++;
    }

    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      select: { id: true, number: true, title: true, status: true, youtubeId: true },
    });
    return json({ episode, iterations });
  } catch (err) {
    return errorJson(`run failed: ${String(err)}`, 500);
  }
}
