import { prisma } from "../../db";
import { getMusicProvider } from "../../providers/registry";
import { withAssetCache } from "../../providers/cache";
import type { StageContext } from "../orchestrator";

// Map a scene mood to a music kind so cues match the emotional beat.
function kindFor(mood: string): "bgm" | "ambient" | "action" | "emotional" {
  const m = mood.toLowerCase();
  if (m.includes("action") || m.includes("excit") || m.includes("chase")) return "action";
  if (m.includes("sad") || m.includes("tender") || m.includes("emotional")) return "emotional";
  if (m.includes("calm") || m.includes("peace") || m.includes("sleep")) return "ambient";
  return "bgm";
}

// MUSIC & SOUND — generate a mood-matched music/ambient bed per scene. Identical
// (mood,duration) requests are cached and reused across scenes/episodes.
export async function runMusic(ctx: StageContext): Promise<Record<string, unknown>> {
  const scenes = await prisma.scene.findMany({
    where: { episodeId: ctx.episodeId },
    orderBy: { index: "asc" },
  });
  const provider = getMusicProvider();

  let cues = 0;
  for (const scene of scenes) {
    if (scene.musicUrl) {
      cues++;
      continue;
    }
    const kind = kindFor(scene.mood);
    const dur = Math.max(5, scene.durationSec || 10);
    const { url } = await withAssetCache({
      kind: "MUSIC",
      episodeId: ctx.episodeId,
      costCategory: "music",
      keyParts: ["music", kind, scene.mood, dur],
      prompt: `${kind} ${scene.mood}`,
      produce: () =>
        provider.generate({ mood: scene.mood, durationSec: dur, kind }),
    });
    await prisma.scene.update({ where: { id: scene.id }, data: { musicUrl: url } });
    cues++;
  }

  return { provider: provider.name, cues };
}
