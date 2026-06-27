import { prisma } from "../../db";
import { config } from "../../config";
import { generateJson } from "../../ai";
import {
  buildContinuityContext,
  continuityToPrompt,
  recordCanon,
} from "../../story/manager";
import type { StageContext } from "../orchestrator";
import type { EpisodeScript } from "../schema";

// SCRIPT WRITING — produce the full episode: title, hook, outline, scene
// breakdown, narration, dialogue, emotional beats, cliffhanger, next-episode
// setup. Targets ~TARGET_EPISODE_SECONDS of screen time.
export async function runScript(ctx: StageContext): Promise<Record<string, unknown>> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: ctx.episodeId },
  });
  const continuity = await buildContinuityContext(episode.seriesId);
  const premise = (episode.script as { premise?: string })?.premise ?? "";
  const target = episode.targetSeconds || config.series.targetSeconds;
  const sceneCount = Math.max(6, Math.round(target / 110)); // ~110s per scene

  const script = await generateJson<EpisodeScript>({
    episodeId: ctx.episodeId,
    maxTokens: 8000,
    system:
      "You are a master children's TV writer. Write warm, funny, emotionally resonant scripts for ages 3-8. Every line of dialogue is kind and age-appropriate. You always end on a gentle cliffhanger that sets up the next episode. Reply ONLY with valid JSON.",
    user: `${continuityToPrompt(continuity)}

PREMISE FOR THIS EPISODE: ${premise}

Write the full episode (~${Math.round(target / 60)} minutes, about ${sceneCount} scenes). Use ONLY existing characters/locations by their exact names. Return JSON matching:
{
 "title": string,
 "hook": string (a 1-2 sentence opening hook),
 "outline": string[] (5-7 beats),
 "theme": string,
 "lesson": string,
 "scenes": [{
   "index": number (0-based),
   "heading": string,
   "location": string (existing location name),
   "characters": string[] (existing character names present),
   "action": string (what visibly happens, for the storyboard),
   "narration": string (warm narrator voice),
   "dialogue": [{"character": string, "line": string, "emotion": string}],
   "mood": string,
   "durationSec": number (sum near ${target})
 }],
 "cliffhanger": string,
 "nextSetup": string,
 "canon": [{"category": "event"|"reveal"|"item"|"rule"|"relationship", "summary": string, "detail": string}]
}`,
  });

  // Resolve character names -> ids for dialogue persistence.
  const chars = await prisma.character.findMany({ where: { seriesId: episode.seriesId } });
  const idByName = new Map(chars.map((c) => [c.name.toLowerCase(), c.id]));

  await prisma.$transaction(async (tx) => {
    await tx.scene.deleteMany({ where: { episodeId: ctx.episodeId } });
    await tx.episode.update({
      where: { id: ctx.episodeId },
      data: {
        title: script.title,
        hook: script.hook,
        outline: script.outline as object,
        cliffhanger: script.cliffhanger,
        nextSetup: script.nextSetup,
        script: script as unknown as object,
      },
    });
    for (const s of script.scenes) {
      await tx.scene.create({
        data: {
          episodeId: ctx.episodeId,
          index: s.index,
          heading: s.heading,
          description: s.action,
          locationRef: s.location,
          characters: (s.characters ?? []) as object,
          narration: s.narration,
          dialogue: (s.dialogue ?? [])
            .filter((d) => d && d.character && d.line)
            .map((d) => ({
              characterId: idByName.get(d.character.toLowerCase()) ?? null,
              character: d.character,
              line: d.line,
              emotion: d.emotion ?? "neutral",
            })) as object,
          mood: s.mood,
          durationSec: s.durationSec ?? 0,
        },
      });
    }
  });

  await recordCanon(episode.seriesId, ctx.episodeId, script.canon ?? []);

  return { title: script.title, scenes: script.scenes.length };
}
