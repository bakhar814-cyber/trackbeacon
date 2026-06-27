// ElevenLabs text-to-speech provider. Streams MP3 bytes, stores them, returns a
// public URL. Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
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

// ElevenLabs bills per character; ~ $0.00018/char on creator tiers (approx).
const USD_PER_CHAR = 0.00018;

interface ElevenVoicesResponse {
  voices?: Array<{ voice_id: string; name: string }>;
}

export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly name = "elevenlabs";

  async listVoices(): Promise<Array<{ id: string; label: string }>> {
    const apiKey = config.keys.elevenlabs;
    if (!apiKey) throw new Error("ElevenLabsVoiceProvider: ELEVENLABS_API_KEY is not set");

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) throw new Error(`ElevenLabs voices error ${res.status}`);
    const json = (await res.json()) as ElevenVoicesResponse;
    return (json.voices ?? []).map((v) => ({ id: v.voice_id, label: v.name }));
  }

  async synthesize(req: VoiceRequest): Promise<ProviderResult<VoiceResult>> {
    const apiKey = config.keys.elevenlabs;
    if (!apiKey) throw new Error("ElevenLabsVoiceProvider: ELEVENLABS_API_KEY is not set");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(req.voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: req.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            ...(req.speed != null ? { speed: req.speed } : {}),
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ElevenLabs TTS error ${res.status}: ${body}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const key = `voice/elevenlabs/${hashKey(req.text, req.voiceId, req.speed ?? 1)}.mp3`;
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
