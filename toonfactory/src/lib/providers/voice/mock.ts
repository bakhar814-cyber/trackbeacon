// Deterministic mock voice provider. Produces a tiny silent WAV buffer whose
// length matches an estimated speaking duration (~2.5 words/sec), stores it via
// putObject as audio/wav, and returns its URL + duration. Zero cost, offline.
import { putObject, hashKey } from "@/lib/storage";
import type {
  ProviderResult,
  VoiceProvider,
  VoiceRequest,
  VoiceResult,
} from "@/lib/providers/types";

// Words-per-second used to estimate narration duration.
const WORDS_PER_SEC = 2.5;
const SAMPLE_RATE = 8000; // low rate keeps the silent buffer tiny

// Build a minimal PCM16 mono silent WAV of the given duration.
export function silentWav(durationSec: number, sampleRate = SAMPLE_RATE): Buffer {
  const samples = Math.max(1, Math.round(durationSec * sampleRate));
  const dataSize = samples * 2; // 16-bit mono
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  // Sample region is already zero-filled (silence).
  return buf;
}

export function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, words / WORDS_PER_SEC);
}

export class MockVoiceProvider implements VoiceProvider {
  readonly name = "mock";

  async listVoices(): Promise<Array<{ id: string; label: string }>> {
    return [
      { id: "pip", label: "Pip (mock)" },
      { id: "bramble", label: "Bramble (mock)" },
      { id: "narrator", label: "Narrator (mock)" },
    ];
  }

  async synthesize(req: VoiceRequest): Promise<ProviderResult<VoiceResult>> {
    const durationSec = estimateDuration(req.text);
    const wav = silentWav(durationSec);
    const key = `voice/mock/${hashKey(req.text, req.voiceId, req.emotion ?? "", req.speed ?? 1)}.wav`;
    const url = await putObject(key, wav, "audio/wav");

    return {
      data: { url, durationSec },
      provider: this.name,
      costMicroUsd: 0,
      meta: { mock: true, voiceId: req.voiceId },
    };
  }
}
