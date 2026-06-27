// Stability AI image provider (Stable Diffusion 3). Stores returned bytes.
// Docs: https://platform.stability.ai/docs/api-reference
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

export class StableDiffusionImageProvider implements ImageProvider {
  readonly name = "stable-diffusion";

  async generate(req: ImageRequest): Promise<ProviderResult<ImageResult>> {
    const apiKey = config.keys.stability;
    if (!apiKey) throw new Error("StableDiffusionImageProvider: STABILITY_API_KEY is not set");

    const width = req.width ?? 1024;
    const height = req.height ?? 1024;

    // SD3 endpoint accepts multipart/form-data and returns raw image bytes when
    // Accept: image/* is set.
    const form = new FormData();
    form.append("prompt", req.prompt);
    form.append("output_format", "png");
    form.append("model", "sd3");
    if (req.negativePrompt) form.append("negative_prompt", req.negativePrompt);
    if (req.seed != null) form.append("seed", String(req.seed));

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "image/*",
      },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Stability SD3 API error ${res.status}: ${body}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const key = `images/sd3/${hashKey(req.prompt, width, height, req.seed ?? 0)}.png`;
    const url = await putObject(key, buf, "image/png");

    return {
      data: { url, width, height, seed: req.seed },
      provider: this.name,
      costMicroUsd: usdToMicro(USD_PER_IMAGE),
      meta: { model: "sd3" },
    };
  }
}
