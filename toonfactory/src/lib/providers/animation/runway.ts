// Runway Gen-3 image-to-video provider. Submits an image_to_video task, polls
// the task until it succeeds, downloads the resulting clip, and stores it.
// Docs: https://docs.dev.runwayml.com/
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import { putObject, hashKey } from "@/lib/storage";
import type {
  AnimationProvider,
  AnimationRequest,
  ClipResult,
  ProviderResult,
} from "@/lib/providers/types";

// Runway Gen-3 ~ $0.05 per second of generated video (approx).
const USD_PER_SEC = 0.05;
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 90;

interface RunwaySubmitResponse {
  id?: string;
}
interface RunwayTaskResponse {
  status?: string;
  output?: string[];
  failure?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Map our motion directives into a short text prompt for the model.
function motionPrompt(req: AnimationRequest): string {
  const parts: string[] = [];
  if (req.motion.camera && req.motion.camera !== "static") {
    parts.push(req.motion.camera.replace("-", " ") + " camera");
  }
  if (req.motion.action) parts.push(req.motion.action);
  return parts.join(", ") || "subtle natural motion";
}

export class RunwayAnimationProvider implements AnimationProvider {
  readonly name = "runway";

  async animate(req: AnimationRequest): Promise<ProviderResult<ClipResult>> {
    const apiKey = config.keys.runway;
    if (!apiKey) throw new Error("RunwayAnimationProvider: RUNWAY_API_KEY is not set");

    const headers = {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "X-Runway-Version": "2024-11-06",
    };

    const submit = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gen3a_turbo",
        promptImage: req.imageUrl,
        promptText: motionPrompt(req),
        duration: Math.min(10, Math.max(1, Math.round(req.durationSec))),
        ratio: "1280:768",
      }),
    });

    if (!submit.ok) {
      const body = await submit.text();
      throw new Error(`Runway submit error ${submit.status}: ${body}`);
    }

    const { id } = (await submit.json()) as RunwaySubmitResponse;
    if (!id) throw new Error("Runway submit returned no task id");

    // Poll the task until it completes.
    let clipUrl: string | undefined;
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const poll = await fetch(`https://api.dev.runwayml.com/v1/tasks/${id}`, { headers });
      if (!poll.ok) continue;
      const task = (await poll.json()) as RunwayTaskResponse;
      if (task.status === "SUCCEEDED" && task.output?.[0]) {
        clipUrl = task.output[0];
        break;
      }
      if (task.status === "FAILED") {
        throw new Error(`Runway task failed: ${task.failure ?? "unknown"}`);
      }
    }

    if (!clipUrl) throw new Error("Runway task timed out");

    const clipRes = await fetch(clipUrl);
    if (!clipRes.ok) throw new Error(`Runway clip fetch error ${clipRes.status}`);
    const buf = Buffer.from(await clipRes.arrayBuffer());

    const key = `clips/runway/${hashKey(req.imageUrl, motionPrompt(req), req.durationSec)}.mp4`;
    const url = await putObject(key, buf, "video/mp4");

    return {
      data: { url, durationSec: req.durationSec },
      provider: this.name,
      costMicroUsd: usdToMicro(req.durationSec * USD_PER_SEC),
      meta: { model: "gen3a_turbo" },
    };
  }
}
