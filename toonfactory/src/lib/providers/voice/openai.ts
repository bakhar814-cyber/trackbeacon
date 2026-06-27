// OpenAI text-to-speech provider (tts-1 / gpt-4o-mini-tts). Returns MP3 bytes.
// Docs: https://platform.openai.com/docs/api-reference/audio/createSpeech
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import { putObject, hashKey } from "@/lib/storage";
import type {
  ProviderResult,
  VoiceProvider,
  VoiceRequest,
  VoiceResult,
} from "@/lib/providers/types";
import { estimateDuration } from "./mock";

// OpenAI TTS ~ $15 / 1M characters.
const USD_PER_CHAR = 15 / 1_000_000;

export class OpenAiVoiceProvider implements VoiceProvider {
  readonly name = "openai";

  async listVoices(): Promise<Array<{ id: string; label: string }>> {
    // OpenAI exposes a fixed set of named voices.
    return ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((id) => ({
      id,
      label: id,
    }));
  }

  async synthesize(req: VoiceRequest): Promise<ProviderResult<VoiceResult>> {
    const apiKey = config.keys.openai;
    if (!apiKey) throw new Error("OpenAiVoiceProvider: OPENAI_API_KEY is not set");

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: req.voiceId || "alloy",
        input: req.text,
        ...(req.speed != null ? { speed: req.speed } : {}),
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI TTS error ${res.status}: ${body}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const key = `voice/openai/${hashKey(req.text, req.voiceId, req.speed ?? 1)}.mp3`;
    const url = await putObject(key, buf, "audio/mpeg");

    const durationSec = estimateDuration(req.text);
    return {
      data: { url, durationSec },
      provider: this.name,
      costMicroUsd: usdToMicro(req.text.length * USD_PER_CHAR),
      meta: { voiceId: req.voiceId, chars: req.text.length },
    };
  }
}
