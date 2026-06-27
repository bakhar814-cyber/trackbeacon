import { prisma } from "../../db";
import { config } from "../../config";
import { getVoiceProvider } from "../../providers/registry";
import { withAssetCache } from "../../providers/cache";
import { hashKey } from "../../storage";
import type { StageContext } from "../orchestrator";

interface SceneDialogue {
  characterId: string | null;
  character: string;
  line: string;
  emotion: string;
}

// VOICE GENERATION — synthesize the narrator track plus each character's lines
// using that character's consistent voice profile and per-line emotion.
export async function runVoice(ctx: StageContext): Promise<Record<string, unknown>> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: ctx.episodeId },
    include: { scenes: { orderBy: { index: "asc" } } },
  });
  const provider = getVoiceProvider();
  const characters = await prisma.character.findMany({
    where: { seriesId: episode.seriesId },
  });
  // A character's mapped voice id is used only if it's a real provider id; the
  // seed's "voice-…" placeholders fall back to the configured default voice so
  // live mode works before you've mapped each character to a real voice.
  const DEFAULT_VOICE = config.keys.elevenlabsDefaultVoice;
  const realId = (v?: string) => (v && !v.startsWith("voice-") ? v : DEFAULT_VOICE);
  const voiceByName = new Map(
    characters.map((c) => [
      c.name.toLowerCase(),
      realId(((c.voiceProfile as { voiceId?: string }) ?? {}).voiceId),
    ]),
  );
  const NARRATOR_VOICE = DEFAULT_VOICE;

  let lines = 0;
  for (const scene of episode.scenes) {
    const tracks: Array<{ role: string; url: string; durationSec: number; text: string }> = [];

    if (scene.narration?.trim()) {
      const { url, result } = await withAssetCache({
        kind: "VOICE",
        episodeId: ctx.episodeId,
        costCategory: "voice",
        keyParts: ["narration", scene.id, hashKey(scene.narration)],
        prompt: scene.narration,
        produce: () =>
          provider.synthesize({
            text: scene.narration,
            voiceId: NARRATOR_VOICE,
            emotion: "warm",
          }),
      });
      tracks.push({ role: "narrator", url, durationSec: result?.durationSec ?? 0, text: scene.narration });
      lines++;
    }

    for (const d of (scene.dialogue as unknown as SceneDialogue[]) ?? []) {
      if (!d?.line?.trim() || !d.character) continue;
      const voiceId = voiceByName.get(d.character.toLowerCase()) ?? DEFAULT_VOICE;
      const { url, result } = await withAssetCache({
        kind: "VOICE",
        episodeId: ctx.episodeId,
        costCategory: "voice",
        keyParts: ["line", scene.id, d.character, hashKey(d.line), d.emotion],
        prompt: d.line,
        produce: () =>
          provider.synthesize({ text: d.line, voiceId, emotion: d.emotion }),
      });
      tracks.push({ role: d.character, url, durationSec: result?.durationSec ?? 0, text: d.line });
      lines++;
    }

    // Refine the scene duration from the actual spoken audio length (+pacing).
    const spoken = tracks.reduce((a, t) => a + (t.durationSec || 0), 0);
    const durationSec = Math.max(scene.durationSec, Math.round(spoken * 1.15) + 1);

    await prisma.scene.update({
      where: { id: scene.id },
      data: { voiceUrls: tracks as object, durationSec },
    });
  }

  return { provider: provider.name, lines };
}
