// Music provider selector.
import { config, effectiveProvider } from "@/lib/config";
import type { MusicProvider } from "@/lib/providers/types";
import { SunoMusicProvider } from "./suno";
import { MockMusicProvider } from "./mock";

export function getMusicProvider(): MusicProvider {
  const hasKey = !!config.keys.suno;
  const chosen = effectiveProvider("music", hasKey);

  switch (chosen) {
    case "suno":
      if (config.keys.suno) return new SunoMusicProvider();
      break;
  }
  return new MockMusicProvider();
}
