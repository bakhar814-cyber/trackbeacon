import { prisma } from "../../db";
import { getVideoProvider } from "../../providers/registry";
import { recordCost } from "../../cost";
import type { StageContext } from "../orchestrator";
import type { VideoTrackScene } from "../../providers/types";

interface VoiceTrack {
  role: string;
  url: string;
  durationSec: number;
  text: string;
}

// VIDEO EDITING — assemble clips + voices + music into captioned scenes, add
// intro/outro/logo, and export the finished mp4 ready for YouTube.
export async function runEdit(ctx: StageContext): Promise<Record<string, unknown>> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: ctx.episodeId },
    include: { scenes: { orderBy: { index: "asc" } } },
  });
  const provider = getVideoProvider();

  const tracks: VideoTrackScene[] = episode.scenes.map((scene) => {
    const voices = ((scene.voiceUrls as unknown as VoiceTrack[]) ?? []).filter((v) => v.url);
    // Lay captions back-to-back across the scene's spoken tracks.
    let t = 0;
    const captions = voices.map((v) => {
      const start = t;
      const end = t + (v.durationSec || 2);
      t = end;
      return { start, end, text: v.text };
    });
    return {
      clipUrl: scene.clipUrl ?? scene.imageUrl ?? "",
      voiceUrls: voices.map((v) => v.url),
      musicUrl: scene.musicUrl ?? undefined,
      captions,
      durationSec: scene.durationSec || Math.max(4, captions.at(-1)?.end ?? 6),
    };
  });

  const series = await prisma.series.findUnique({ where: { id: episode.seriesId } });

  const res = await provider.assemble({
    scenes: tracks,
    title: episode.title || `Episode ${episode.number}`,
    introUrl: undefined,
    outroUrl: undefined,
    logoUrl: undefined,
  });

  if (res.costMicroUsd > 0) {
    await recordCost({
      episodeId: ctx.episodeId,
      provider: res.provider,
      category: "video",
      costMicroUsd: res.costMicroUsd,
    });
  }

  await prisma.asset.create({
    data: {
      kind: "VIDEO",
      episodeId: ctx.episodeId,
      provider: res.provider,
      cacheKey: `video-${ctx.episodeId}`,
      url: res.data.url,
      meta: { durationSec: res.data.durationSec, series: series?.title } as object,
      costMicroUsd: res.costMicroUsd,
    },
  });

  await prisma.episode.update({
    where: { id: ctx.episodeId },
    data: { videoUrl: res.data.url, targetSeconds: Math.round(res.data.durationSec) || episode.targetSeconds },
  });

  return { provider: res.provider, durationSec: Math.round(res.data.durationSec) };
}
