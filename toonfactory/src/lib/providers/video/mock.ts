// Deterministic mock video provider. Writes a tiny placeholder buffer (a short
// text/JSON manifest masquerading as an mp4) via putObject and returns its URL
// plus the summed scene duration. Fully offline, zero cost.
import { putObject, hashKey } from "@/lib/storage";
import type {
  ProviderResult,
  VideoAssembleRequest,
  VideoProvider,
  VideoResult,
} from "@/lib/providers/types";

export class MockVideoProvider implements VideoProvider {
  readonly name = "mock";

  async assemble(req: VideoAssembleRequest): Promise<ProviderResult<VideoResult>> {
    const durationSec = req.scenes.reduce((s, sc) => s + Math.max(0, sc.durationSec), 0);

    // A human-readable placeholder describing what a real render would contain.
    const manifest = JSON.stringify(
      {
        mock: true,
        title: req.title,
        sceneCount: req.scenes.length,
        durationSec,
        intro: req.introUrl ?? null,
        outro: req.outroUrl ?? null,
        scenes: req.scenes.map((s, i) => ({
          index: i,
          clipUrl: s.clipUrl,
          voiceTracks: s.voiceUrls.length,
          music: !!s.musicUrl,
          captions: s.captions?.length ?? 0,
          durationSec: s.durationSec,
        })),
      },
      null,
      2,
    );

    const key = `video/mock/${hashKey(req.title, req.scenes.map((s) => s.clipUrl))}.mp4`;
    // Stored as text/plain so it is obviously a placeholder, not a real mp4.
    const url = await putObject(key, manifest, "text/plain");

    return {
      data: { url, durationSec },
      provider: this.name,
      costMicroUsd: 0,
      meta: { mock: true, scenes: req.scenes.length },
    };
  }
}
