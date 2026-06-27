import { prisma } from "../../db";
import { getImageProvider } from "../../providers/registry";
import { withAssetCache } from "../../providers/cache";
import { hashKey } from "../../storage";
import type { StageContext } from "../orchestrator";

// Derive a stable numeric seed from a string so the same character/scene always
// regenerates with the same composition — a key consistency lever.
function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647;
  return h;
}

// IMAGE GENERATION — first make sure each character has a canonical reference
// image (generated once, reused forever for consistency), then render every
// scene frame with those references passed to the image model.
export async function runImages(ctx: StageContext): Promise<Record<string, unknown>> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: ctx.episodeId },
    include: { scenes: { orderBy: { index: "asc" } } },
  });
  const provider = getImageProvider();
  const characters = await prisma.character.findMany({
    where: { seriesId: episode.seriesId },
  });

  // 1) Canonical character references (cached across the whole series).
  const refByName = new Map<string, string>();
  for (const c of characters) {
    if (c.refImageUrl) {
      refByName.set(c.name.toLowerCase(), c.refImageUrl);
      continue;
    }
    const prompt = `Character reference sheet, neutral pose, plain background. ${c.designToken}`;
    const seed = seedFrom(c.id);
    const { url } = await withAssetCache({
      kind: "CHARACTER",
      episodeId: ctx.episodeId,
      costCategory: "image",
      keyParts: ["char-ref", c.id, c.designToken],
      prompt,
      produce: () => provider.generate({ prompt, seed, width: 768, height: 768 }),
    });
    await prisma.character.update({ where: { id: c.id }, data: { refImageUrl: url } });
    refByName.set(c.name.toLowerCase(), url);
  }

  // 2) Scene frames, with character refs supplied for consistency.
  let rendered = 0;
  for (const scene of episode.scenes) {
    if (scene.imageUrl) {
      rendered++;
      continue;
    }
    const names = (scene.characters as string[]) ?? [];
    const refs = names
      .map((n) => refByName.get(String(n).toLowerCase()))
      .filter((x): x is string => Boolean(x));
    const seed = seedFrom(scene.id);
    const { url } = await withAssetCache({
      kind: "ACTION",
      episodeId: ctx.episodeId,
      costCategory: "image",
      keyParts: ["scene", scene.id, hashKey(scene.imagePrompt), refs],
      prompt: scene.imagePrompt,
      produce: () =>
        provider.generate({
          prompt: scene.imagePrompt,
          refs,
          seed,
          width: 1280,
          height: 720,
        }),
    });
    await prisma.scene.update({ where: { id: scene.id }, data: { imageUrl: url } });
    rendered++;
  }

  return { provider: provider.name, frames: rendered };
}
