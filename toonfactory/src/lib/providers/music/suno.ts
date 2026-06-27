// Suno music generation provider. Submits a generation job, polls until audio is
// ready, downloads the bytes, and stores them. Endpoint shapes vary across Suno
// API gateways; this targets the common HackMIT-style REST surface.
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import { putObject, hashKey } from "@/lib/storage";
import type {
  AudioResult,
  MusicProvider,
  MusicRequest,
  ProviderResult,
} from "@/lib/providers/types";

// Rough per-generation cost.
const USD_PER_TRACK = 0.1;
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60;

interface SunoSubmitResponse {
  id?: string;
  // Some gateways return an array of clip objects on submit.
  clips?: Array<{ id?: string }>;
}
interface SunoClip {
  status?: string;
  audio_url?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class SunoMusicProvider implements MusicProvider {
  readonly name = "suno";

  async generate(req: MusicRequest): Promise<ProviderResult<AudioResult>> {
    const apiKey = config.keys.suno;
    if (!apiKey) throw new Error("SunoMusicProvider: SUNO_API_KEY is not set");

    const prompt = req.prompt ?? `${req.mood} ${req.kind} instrumental, ${req.durationSec}s, looping`;

    const submit = await fetch("https://studio-api.suno.ai/api/generate/v2/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        make_instrumental: req.kind !== "sfx",
        tags: req.mood,
      }),
    });

    if (!submit.ok) {
      const body = await submit.text();
      throw new Error(`Suno submit error ${submit.status}: ${body}`);
    }

    const submitJson = (await submit.json()) as SunoSubmitResponse;
    const clipId = submitJson.id ?? submitJson.clips?.[0]?.id;
    if (!clipId) throw new Error("Suno submit returned no clip id");

    // Poll the feed endpoint until the clip is streamable/complete.
    let audioUrl: string | undefined;
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const poll = await fetch(
        `https://studio-api.suno.ai/api/feed/?ids=${encodeURIComponent(clipId)}`,
        { headers: { authorization: `Bearer ${apiKey}` } },
      );
      if (!poll.ok) continue;
      const clips = (await poll.json()) as SunoClip[];
      const clip = Array.isArray(clips) ? clips[0] : undefined;
      if (clip?.status === "complete" && clip.audio_url) {
        audioUrl = clip.audio_url;
        break;
      }
      if (clip?.status === "error") throw new Error("Suno generation failed");
    }

    if (!audioUrl) throw new Error("Suno generation timed out");

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Suno audio fetch error ${audioRes.status}`);
    const buf = Buffer.from(await audioRes.arrayBuffer());

    const key = `music/suno/${hashKey(prompt, req.durationSec)}.mp3`;
    const url = await putObject(key, buf, "audio/mpeg");

    return {
      data: { url, durationSec: req.durationSec },
      provider: this.name,
      costMicroUsd: usdToMicro(USD_PER_TRACK),
      meta: { mood: req.mood, kind: req.kind },
    };
  }
}
