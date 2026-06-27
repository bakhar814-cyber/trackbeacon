// Google Cloud Text-to-Speech provider. Returns base64 MP3 in JSON.
// Docs: https://cloud.google.com/text-to-speech/docs/reference/rest
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

// Google WaveNet TTS ~ $16 / 1M characters.
const USD_PER_CHAR = 16 / 1_000_000;

interface GoogleTtsResponse {
  audioContent?: string;
}

export class GoogleVoiceProvider implements VoiceProvider {
  readonly name = "google";

  async synthesize(req: VoiceRequest): Promise<ProviderResult<VoiceResult>> {
    const apiKey = config.keys.googleTts;
    if (!apiKey) throw new Error("GoogleVoiceProvider: GOOGLE_TTS_API_KEY is not set");

    // voiceId is expected as e.g. "en-US-Wavenet-D"; derive language from prefix.
    const languageCode = req.voiceId.split("-").slice(0, 2).join("-") || "en-US";

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { text: req.text },
          voice: { languageCode, name: req.voiceId },
          audioConfig: {
            audioEncoding: "MP3",
            ...(req.speed != null ? { speakingRate: req.speed } : {}),
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google TTS error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as GoogleTtsResponse;
    if (!json.audioContent) throw new Error("Google TTS returned no audio");

    const buf = Buffer.from(json.audioContent, "base64");
    const key = `voice/google/${hashKey(req.text, req.voiceId, req.speed ?? 1)}.mp3`;
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
