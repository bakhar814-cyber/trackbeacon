import { prisma } from "../../db";
import { getAnimationProvider } from "../../providers/registry";
import { withAssetCache } from "../../providers/cache";
import type { StageContext } from "../orchestrator";

// Choose a camera move from the scene mood for a little visual variety.
function cameraFor(mood: string, index: number): "pan-left" | "pan-right" | "zoom-in" | "zoom-out" | "static" {
  const m = mood.toLowerCase();
  if (m.includes("excit") || m.includes("action")) return index % 2 ? "zoom-in" : "pan-right";
  if (m.includes("calm") || m.includes("sad")) return "zoom-out";
  return index % 2 ? "pan-left" : "static";
}

// ANIMATION — convert each still frame into a moving clip (camera move,
// character motion, scene transition). Lip-sync audio is attached later by the
// edit stage once voice exists; providers that support it can also take it here.
export async function runAnimation(ctx: StageContext): Promise<Record<string, unknown>> {
  const scenes = await prisma.scene.findMany({
    where: { episodeId: ctx.episodeId },
    orderBy: { index: "asc" },
  });
  const provider = getAnimationProvider();

  let animated = 0;
  for (const scene of scenes) {
    if (!scene.imageUrl || scene.clipUrl) {
      if (scene.clipUrl) animated++;
      continue;
    }
    const { url } = await withAssetCache({
      kind: "CLIP",
      episodeId: ctx.episodeId,
      costCategory: "animation",
      keyParts: ["clip", scene.id, scene.imageUrl, scene.mood],
      prompt: scene.description,
      produce: () =>
        provider.animate({
          imageUrl: scene.imageUrl as string,
          motion: {
            camera: cameraFor(scene.mood, scene.index),
            action: scene.description,
            transition: "crossfade",
          },
          durationSec: Math.max(4, scene.durationSec || 8),
        }),
    });
    await prisma.scene.update({ where: { id: scene.id }, data: { clipUrl: url } });
    animated++;
  }

  return { provider: provider.name, clips: animated };
}
