// Shotstack cloud video assembly provider. Builds a Shotstack edit JSON from the
// requested scenes, submits the render, polls until done, downloads the result,
// and stores it. Docs: https://shotstack.io/docs/api/
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import { putObject, hashKey } from "@/lib/storage";
import type {
  ProviderResult,
  VideoAssembleRequest,
  VideoProvider,
  VideoResult,
} from "@/lib/providers/types";

// Shotstack renders are billed per output minute (~ $0.40/min on standard).
const USD_PER_MINUTE = 0.4;
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 120;

interface ShotstackClip {
  asset: { type: string; src: string };
  start: number;
  length: number;
}
interface ShotstackTrack {
  clips: ShotstackClip[];
}
interface ShotstackRenderResponse {
  response?: { id?: string };
}
interface ShotstackStatusResponse {
  response?: { status?: string; url?: string; error?: string };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class ShotstackVideoProvider implements VideoProvider {
  readonly name = "shotstack";

  async assemble(req: VideoAssembleRequest): Promise<ProviderResult<VideoResult>> {
    const apiKey = config.keys.shotstack;
    if (!apiKey) throw new Error("ShotstackVideoProvider: SHOTSTACK_API_KEY is not set");
    if (req.scenes.length === 0) {
      throw new Error("ShotstackVideoProvider: no scenes to assemble");
    }

    // Lay out a video track (clips) and an audio track (voice) sequentially.
    const videoClips: ShotstackClip[] = [];
    const audioClips: ShotstackClip[] = [];
    let cursor = 0;

    if (req.introUrl) {
      videoClips.push({ asset: { type: "video", src: req.introUrl }, start: cursor, length: 3 });
      cursor += 3;
    }

    for (const scene of req.scenes) {
      videoClips.push({
        asset: { type: "video", src: scene.clipUrl },
        start: cursor,
        length: scene.durationSec,
      });
      const voice = scene.voiceUrls[0];
      if (voice) {
        audioClips.push({
          asset: { type: "audio", src: voice },
          start: cursor,
          length: scene.durationSec,
        });
      }
      cursor += scene.durationSec;
    }

    if (req.outroUrl) {
      videoClips.push({ asset: { type: "video", src: req.outroUrl }, start: cursor, length: 3 });
      cursor += 3;
    }

    const tracks: ShotstackTrack[] = [{ clips: videoClips }];
    if (audioClips.length) tracks.push({ clips: audioClips });

    const edit = {
      timeline: { background: "#000000", tracks },
      output: { format: "mp4", resolution: "hd" },
    };

    const submit = await fetch("https://api.shotstack.io/v1/render", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(edit),
    });
    if (!submit.ok) {
      const body = await submit.text();
      throw new Error(`Shotstack submit error ${submit.status}: ${body}`);
    }

    const renderId = ((await submit.json()) as ShotstackRenderResponse).response?.id;
    if (!renderId) throw new Error("Shotstack submit returned no render id");

    let videoUrl: string | undefined;
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const poll = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, {
        headers: { "x-api-key": apiKey },
      });
      if (!poll.ok) continue;
      const status = ((await poll.json()) as ShotstackStatusResponse).response;
      if (status?.status === "done" && status.url) {
        videoUrl = status.url;
        break;
      }
      if (status?.status === "failed") {
        throw new Error(`Shotstack render failed: ${status.error ?? "unknown"}`);
      }
    }

    if (!videoUrl) throw new Error("Shotstack render timed out");

    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Shotstack download error ${videoRes.status}`);
    const buf = Buffer.from(await videoRes.arrayBuffer());

    const key = `video/shotstack/${hashKey(req.title, req.scenes.map((s) => s.clipUrl))}.mp4`;
    const url = await putObject(key, buf, "video/mp4");

    const durationSec = cursor;
    return {
      data: { url, durationSec },
      provider: this.name,
      costMicroUsd: usdToMicro((durationSec / 60) * USD_PER_MINUTE),
      meta: { renderId },
    };
  }
}
