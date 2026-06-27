import { prisma } from "../../db";
import type { StageContext } from "../orchestrator";

// STORYBOARD — turn each scene's action into a precise image prompt. The prompt
// embeds each present character's frozen `designToken` and the location's visual
// spec plus the series art style, which is how character/visual consistency is
// enforced across every episode.
export async function runStoryboard(ctx: StageContext): Promise<Record<string, unknown>> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: ctx.episodeId },
    include: { series: true, scenes: { orderBy: { index: "asc" } } },
  });
  const characters = await prisma.character.findMany({
    where: { seriesId: episode.seriesId },
  });
  const locations = await prisma.location.findMany({
    where: { seriesId: episode.seriesId },
  });
  const charByName = new Map(characters.map((c) => [c.name.toLowerCase(), c]));
  const locByName = new Map(locations.map((l) => [l.name.toLowerCase(), l]));

  const style = episode.series.artStyle as Record<string, unknown>;
  const styleStr = Object.values(style).join(", ");

  let count = 0;
  for (const scene of episode.scenes) {
    const names = (scene.characters as string[]) ?? [];
    const charTokens = names
      .map((n) => charByName.get(String(n).toLowerCase())?.designToken)
      .filter(Boolean)
      .join("; ");
    const loc = scene.locationRef
      ? locByName.get(scene.locationRef.toLowerCase())
      : undefined;
    const locStr = loc
      ? `${loc.name}: ${loc.description}`
      : scene.locationRef ?? "";

    const prompt = [
      `${styleStr}.`,
      `Scene: ${scene.description}.`,
      charTokens ? `Characters (keep designs identical): ${charTokens}.` : "",
      locStr ? `Setting: ${locStr}.` : "",
      `Mood: ${scene.mood}.`,
      `16:9 cinematic kids cartoon frame, no text, no watermark.`,
    ]
      .filter(Boolean)
      .join(" ");

    await prisma.scene.update({
      where: { id: scene.id },
      data: { imagePrompt: prompt },
    });
    count++;
  }

  return { storyboards: count };
}
