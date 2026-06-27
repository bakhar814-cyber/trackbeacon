// Flux image provider (Black Forest Labs). Submits a generation request, polls
// until the result is ready, downloads the bytes, and stores them.
// Docs: https://docs.bfl.ml/
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import { putObject, hashKey } from "@/lib/storage";
import type {
  ImageProvider,
  ImageRequest,
  ImageResult,
  ProviderResult,
} from "@/lib/providers/types";

const USD_PER_IMAGE = 0.04;
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 60;

interface FluxSubmitResponse {
  id?: string;
}
interface FluxResultResponse {
  status?: string;
  result?: { sample?: string };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class FluxImageProvider implements ImageProvider {
  readonly name = "flux";

  async generate(req: ImageRequest): Promise<ProviderResult<ImageResult>> {
    const apiKey = config.keys.flux;
    if (!apiKey) throw new Error("FluxImageProvider: FLUX_API_KEY is not set");

    const width = req.width ?? 1024;
    const height = req.height ?? 1024;

    const submit = await fetch("https://api.bfl.ml/v1/flux-pro-1.1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-key": apiKey,
      },
      body: JSON.stringify({
        prompt: req.prompt,
        width,
        height,
        ...(req.seed != null ? { seed: req.seed } : {}),
      }),
    });

    if (!submit.ok) {
      const body = await submit.text();
      throw new Error(`Flux submit error ${submit.status}: ${body}`);
    }

    const { id } = (await submit.json()) as FluxSubmitResponse;
    if (!id) throw new Error("Flux submit returned no task id");

    // Poll for completion.
    let sampleUrl: string | undefined;
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const poll = await fetch(`https://api.bfl.ml/v1/get_result?id=${encodeURIComponent(id)}`, {
        headers: { "x-key": apiKey },
      });
      if (!poll.ok) continue;
      const data = (await poll.json()) as FluxResultResponse;
      if (data.status === "Ready" && data.result?.sample) {
        sampleUrl = data.result.sample;
        break;
      }
      if (data.status && ["Error", "Failed", "Content Moderated"].includes(data.status)) {
        throw new Error(`Flux generation failed with status: ${data.status}`);
      }
    }

    if (!sampleUrl) throw new Error("Flux generation timed out");

    const imgRes = await fetch(sampleUrl);
    if (!imgRes.ok) throw new Error(`Flux image fetch error ${imgRes.status}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());

    const key = `images/flux/${hashKey(req.prompt, width, height, req.seed ?? 0)}.png`;
    const url = await putObject(key, buf, "image/png");

    return {
      data: { url, width, height, seed: req.seed },
      provider: this.name,
      costMicroUsd: usdToMicro(USD_PER_IMAGE),
      meta: { model: "flux-pro-1.1" },
    };
  }
}
