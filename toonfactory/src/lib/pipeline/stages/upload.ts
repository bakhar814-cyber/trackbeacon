import { prisma } from "../../db";
import { config } from "../../config";
import { recordCost } from "../../cost";
import { uploadVideo } from "../../youtube/client";
import type { StageContext } from "../orchestrator";
import type { EpisodeSeo } from "../schema";

// Compute the next publishing slot, spreading EPISODES_PER_DAY evenly across the
// day and skipping slots already claimed by scheduled episodes.
async function nextSlot(): Promise<Date> {
  const perDay = Math.max(1, config.series.episodesPerDay);
  const hours = Array.from({ length: perDay }, (_, i) =>
    Math.round((24 / perDay) * i) + 8 - (perDay > 1 ? 0 : 0),
  ).map((h) => ((h % 24) + 24) % 24);

  const taken = new Set(
    (
      await prisma.episode.findMany({
        where: { scheduledFor: { gte: new Date() } },
        select: { scheduledFor: true },
      })
    )
      .map((e) => e.scheduledFor?.getTime())
      .filter(Boolean) as number[],
  );

  const now = new Date();
  for (let day = 0; day < 30; day++) {
    for (const h of hours) {
      const slot = new Date(now);
      slot.setDate(now.getDate() + day);
      slot.setHours(h, 0, 0, 0);
      if (slot.getTime() > now.getTime() + 60_000 && !taken.has(slot.getTime())) {
        return slot;
      }
    }
  }
  return new Date(now.getTime() + 3600_000);
}

// UPLOAD — publish/schedule the finished episode to YouTube with its thumbnail,
// SEO metadata, made-for-kids flag, and an even publishing cadence.
export async function runUpload(ctx: StageContext): Promise<Record<string, unknown>> {
  const episode = await prisma.episode.findUniqueOrThrow({ where: { id: ctx.episodeId } });
  const seo = (episode.seo as unknown as EpisodeSeo) ?? ({} as EpisodeSeo);

  if (!episode.videoUrl) throw new Error("cannot upload: no video");

  const publishAt = await nextSlot();

  const result = await uploadVideo({
    title: seo.title || episode.title,
    description: seo.description || episode.hook,
    tags: seo.tags ?? [],
    videoUrl: episode.videoUrl,
    thumbnailUrl: episode.thumbnailUrl ?? undefined,
    madeForKids: true,
    publishAt,
  });

  // YouTube upload itself is free; record a tiny bandwidth line for visibility.
  await recordCost({
    episodeId: ctx.episodeId,
    provider: result.mock ? "mock" : "youtube",
    category: "upload",
    costMicroUsd: 0,
  });

  await prisma.episode.update({
    where: { id: ctx.episodeId },
    data: {
      youtubeId: result.youtubeId,
      status: "SCHEDULED",
      scheduledFor: publishAt,
    },
  });

  return {
    youtubeId: result.youtubeId,
    scheduledFor: publishAt.toISOString(),
    mock: result.mock,
  };
}
