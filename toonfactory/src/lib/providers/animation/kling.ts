// Kling AI image-to-video provider. Submits a task, polls until done, downloads
// and stores the clip. Docs: https://app.klingai.com/global/dev/document-api
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import { putObject, hashKey } from "@/lib/storage";
import type {
  AnimationProvider,
  AnimationRequest,
  ClipResult,
  ProviderResult,
} from "@/lib/providers/types";

// Kling ~ $0.04 per second of generated video (approx).
const USD_PER_SEC = 0.04;
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 120;

interface KlingSubmitResponse {
  data?: { task_id?: string };
}
interface KlingTaskResponse {
  data?: {
    task_status?: string;
    task_result?: { videos?: Array<{ url?: string }> };
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function cameraToKling(camera: AnimationRequest["motion"]["camera"]): string {
  switch (camera) {
    case "zoom-in":
      return "zoom_in";
    case "zoom-out":
      return "zoom_out";
    case "pan-left":
      return "horizontal_left";
    case "pan-right":
      return "horizontal_right";
    default:
      return "none";
  }
}

export class KlingAnimationProvider implements AnimationProvider {
  readonly name = "kling";

  async animate(req: AnimationRequest): Promise<ProviderResult<ClipResult>> {
    const apiKey = config.keys.kling;
    if (!apiKey) throw new Error("KlingAnimationProvider: KLING_API_KEY is not set");

    const headers = {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    };

    const submit = await fetch("https://api.klingai.com/v1/videos/image2video", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model_name: "kling-v1",
        image: req.imageUrl,
        prompt: req.motion.action ?? "subtle natural motion",
        duration: String(Math.min(10, Math.max(5, Math.round(req.durationSec)))),
        camera_control: { type: cameraToKling(req.motion.camera) },
      }),
    });

    if (!submit.ok) {
      const body = await submit.text();
      throw new Error(`Kling submit error ${submit.status}: ${body}`);
    }

    const taskId = ((await submit.json()) as KlingSubmitResponse).data?.task_id;
    if (!taskId) throw new Error("Kling submit returned no task id");

    let clipUrl: string | undefined;
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const poll = await fetch(
        `https://api.klingai.com/v1/videos/image2video/${encodeURIComponent(taskId)}`,
        { headers },
      );
      if (!poll.ok) continue;
      const task = (await poll.json()) as KlingTaskResponse;
      const status = task.data?.task_status;
      if (status === "succeed" && task.data?.task_result?.videos?.[0]?.url) {
        clipUrl = task.data.task_result.videos[0].url;
        break;
      }
      if (status === "failed") throw new Error("Kling task failed");
    }

    if (!clipUrl) throw new Error("Kling task timed out");

    const clipRes = await fetch(clipUrl);
    if (!clipRes.ok) throw new Error(`Kling clip fetch error ${clipRes.status}`);
    const buf = Buffer.from(await clipRes.arrayBuffer());

    const key = `clips/kling/${hashKey(req.imageUrl, req.motion.action ?? "", req.durationSec)}.mp4`;
    const url = await putObject(key, buf, "video/mp4");

    return {
      data: { url, durationSec: req.durationSec },
      provider: this.name,
      costMicroUsd: usdToMicro(req.durationSec * USD_PER_SEC),
      meta: { model: "kling-v1" },
    };
  }
}
