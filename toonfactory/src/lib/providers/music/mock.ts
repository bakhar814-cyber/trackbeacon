// Deterministic mock music/SFX provider. Produces a silent WAV of the requested
// duration, stores it via putObject, and returns its URL + duration. Offline.
import { putObject, hashKey } from "@/lib/storage";
import { silentWav } from "@/lib/providers/voice/mock";
import type {
  AudioResult,
  MusicProvider,
  MusicRequest,
  ProviderResult,
} from "@/lib/providers/types";

export class MockMusicProvider implements MusicProvider {
  readonly name = "mock";

  async generate(req: MusicRequest): Promise<ProviderResult<AudioResult>> {
    const durationSec = Math.max(1, req.durationSec);
    const wav = silentWav(durationSec);
    const key = `music/mock/${hashKey(req.mood, req.kind, durationSec, req.prompt ?? "")}.wav`;
    const url = await putObject(key, wav, "audio/wav");

    return {
      data: { url, durationSec },
      provider: this.name,
      costMicroUsd: 0,
      meta: { mock: true, mood: req.mood, kind: req.kind },
    };
  }
}
