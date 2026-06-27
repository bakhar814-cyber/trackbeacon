// Voice provider selector.
import { config, effectiveProvider } from "@/lib/config";
import type { VoiceProvider } from "@/lib/providers/types";
import { ElevenLabsVoiceProvider } from "./elevenlabs";
import { OpenAiVoiceProvider } from "./openai";
import { GoogleVoiceProvider } from "./google";
import { MockVoiceProvider } from "./mock";

export function getVoiceProvider(): VoiceProvider {
  const hasKey = !!(
    config.keys.elevenlabs ||
    config.keys.openai ||
    config.keys.googleTts
  );
  const chosen = effectiveProvider("voice", hasKey);

  switch (chosen) {
    case "elevenlabs":
      if (config.keys.elevenlabs) return new ElevenLabsVoiceProvider();
      break;
    case "openai":
      if (config.keys.openai) return new OpenAiVoiceProvider();
      break;
    case "google":
      if (config.keys.googleTts) return new GoogleVoiceProvider();
      break;
  }
  return new MockVoiceProvider();
}
