import { prisma } from "@/lib/db";
import { json, errorJson } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/episodes/:id — full episode detail.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const episode = await prisma.episode.findUnique({
    where: { id: params.id },
    include: {
      scenes: { orderBy: { index: "asc" } },
      thumbnails: { orderBy: { score: "desc" } },
      jobs: { orderBy: { createdAt: "desc" } },
      assets: true,
      analytics: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
  });
  if (!episode) return errorJson("not found", 404);
  return json({ episode });
}
