import { prisma } from "../../db";
import { getImageProvider } from "../../providers/registry";
import { withAssetCache } from "../../providers/cache";
import { scoreThumbnail } from "../../thumbnail/score";
import { hashKey } from "../../storage";
import type { StageContext } from "../orchestrator";

// THUMBNAIL — generate several distinct concepts, score each with the CTR
// predictor, and promote the best one to the episode.
const CONCEPTS = [
  "Extreme close-up of the hero's face with a big surprised happy expression, bright vivid high-contrast colors, large bold title text (1-3 words), glowing background",
  "Two characters mid-action with excited smiling faces, vibrant neon background, big bold text, close-up",
  "Hero pointing at a glowing magical object, wow expression, bright colors, large readable text, portrait close-up",
];

function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647;
  return h;
}

export async function runThumbnail(ctx: StageContext): Promise<Record<string, unknown>> {
  const episode = await prisma.episode.findUniqueOrThrow({ where: { id: ctx.episodeId } });
  const provider = getImageProvider();

  await prisma.thumbnail.deleteMany({ where: { episodeId: ctx.episodeId } });

  const made: Array<{ id: string; score: number; url: string }> = [];
  for (let i = 0; i < CONCEPTS.length; i++) {
    const prompt = `YouTube kids thumbnail for "${episode.title}". ${CONCEPTS[i]}.`;
    const seed = seedFrom(`${episode.id}-${i}`);
    const { url } = await withAssetCache({
      kind: "THUMBNAIL",
      episodeId: ctx.episodeId,
      costCategory: "image",
      keyParts: ["thumb", episode.id, i, hashKey(prompt)],
      prompt,
      produce: () => provider.generate({ prompt, seed, width: 1280, height: 720 }),
    });
    const { score, detail } = scoreThumbnail(prompt, seed);
    const row = await prisma.thumbnail.create({
      data: { episodeId: ctx.episodeId, url, prompt, score, scoreDetail: detail as object },
    });
    made.push({ id: row.id, score, url });
  }

  const best = made.sort((a, b) => b.score - a.score)[0];
  if (best) {
    await prisma.thumbnail.update({ where: { id: best.id }, data: { chosen: true } });
    await prisma.episode.update({
      where: { id: ctx.episodeId },
      data: { thumbnailUrl: best.url },
    });
  }

  return { candidates: made.length, bestScore: best?.score ?? 0 };
}
