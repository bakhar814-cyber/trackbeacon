import { prisma } from "../../db";
import { generateJson } from "../../ai";
import type { StageContext } from "../orchestrator";
import type { EpisodeSeo } from "../schema";

// SEO — generate an optimized title, description, tags, keywords, hashtags, and
// timestamped chapters (chapters are computed from real scene durations so they
// always line up with the finished video).
export async function runSeo(ctx: StageContext): Promise<Record<string, unknown>> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: ctx.episodeId },
    include: { scenes: { orderBy: { index: "asc" } }, series: true },
  });

  // Compute chapter timestamps from accumulated scene durations.
  let t = 0;
  const chapters: Array<{ start: number; label: string }> = [{ start: 0, label: "Intro" }];
  for (const s of episode.scenes) {
    if (s.heading) chapters.push({ start: t, label: s.heading });
    t += s.durationSec || 0;
  }

  const seo = await generateJson<EpisodeSeo>({
    episodeId: ctx.episodeId,
    system:
      "You are a YouTube SEO expert for a kids cartoon channel. Write titles and descriptions that are honest, child-safe, and optimized for search and recommendations. Reply ONLY with JSON.",
    user: `Episode #${episode.number} of "${episode.series.title}".
Title: ${episode.title}
Hook: ${episode.hook}
Outline: ${JSON.stringify(episode.outline)}

Return JSON:
{
 "title": string (<=90 chars, catchy, kid-safe, includes the series name),
 "description": string (2-3 short paragraphs + a friendly call to subscribe),
 "tags": string[] (15-20 relevant tags),
 "keywords": string[] (8-12),
 "hashtags": string[] (3-5, each starting with #)
}`,
  });

  const finalSeo: EpisodeSeo = { ...seo, chapters };

  await prisma.episode.update({
    where: { id: ctx.episodeId },
    data: {
      seo: finalSeo as unknown as object,
      // Prefer the SEO-optimized title for the published video.
      title: seo.title || episode.title,
    },
  });

  return { tags: finalSeo.tags?.length ?? 0, chapters: chapters.length };
}
