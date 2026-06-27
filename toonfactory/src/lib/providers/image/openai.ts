// OpenAI image provider (gpt-image-1). Generates an image, stores the returned
// bytes via putObject, and returns a public URL.
// Docs: https://platform.openai.com/docs/api-reference/images
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import { putObject, hashKey } from "@/lib/storage";
import type {
  ImageProvider,
  ImageRequest,
  ImageResult,
  ProviderResult,
} from "@/lib/providers/types";

// Rough cost per generated image.
const USD_PER_IMAGE = 0.04;

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

export class OpenAiImageProvider implements ImageProvider {
  readonly name = "openai";

  async generate(req: ImageRequest): Promise<ProviderResult<ImageResult>> {
    const apiKey = config.keys.openai;
    if (!apiKey) throw new Error("OpenAiImageProvider: OPENAI_API_KEY is not set");

    const width = req.width ?? 1024;
    const height = req.height ?? 1024;

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: req.prompt,
        size: `${width}x${height}`,
        n: 1,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI image API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as OpenAiImageResponse;
    const b64 = json.data?.[0]?.b64_json;
    const remoteUrl = json.data?.[0]?.url;

    let buf: Buffer;
    if (b64) {
      buf = Buffer.from(b64, "base64");
    } else if (remoteUrl) {
      const imgRes = await fetch(remoteUrl);
      if (!imgRes.ok) throw new Error(`OpenAI image fetch error ${imgRes.status}`);
      buf = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw new Error("OpenAI image API returned no image data");
    }

    const key = `images/openai/${hashKey(req.prompt, width, height, req.seed ?? 0)}.png`;
    const url = await putObject(key, buf, "image/png");

    return {
      data: { url, width, height, seed: req.seed },
      provider: this.name,
      costMicroUsd: usdToMicro(USD_PER_IMAGE),
      meta: { model: "gpt-image-1" },
    };
  }
}
