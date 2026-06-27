// OpenAI image provider (gpt-image-1). Generates an image, stores the returned
// bytes via putObject, and returns a public URL.
// Docs: https://platform.openai.com/docs/api-reference/images
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import { putObject, hashKey } from "@/lib/storage";
import { fetchRetry } from "@/lib/providers/http";
import type {
  ImageProvider,
  ImageRequest,
  ImageResult,
  ProviderResult,
} from "@/lib/providers/types";

// Approx cost for a "medium" quality 1024-class image. Adjust per quality tier.
const USD_PER_IMAGE = 0.04;

// gpt-image-1 only accepts these sizes — map the requested aspect ratio onto the
// nearest supported one (arbitrary sizes like 1280x720 return a 400 otherwise).
function mapSize(w: number, h: number): { size: string; width: number; height: number } {
  const ratio = w / h;
  if (ratio > 1.2) return { size: "1536x1024", width: 1536, height: 1024 }; // landscape
  if (ratio < 0.83) return { size: "1024x1536", width: 1024, height: 1536 }; // portrait
  return { size: "1024x1024", width: 1024, height: 1024 }; // square
}

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

export class OpenAiImageProvider implements ImageProvider {
  readonly name = "openai";

  async generate(req: ImageRequest): Promise<ProviderResult<ImageResult>> {
    const apiKey = config.keys.openai;
    if (!apiKey) throw new Error("OpenAiImageProvider: OPENAI_API_KEY is not set");

    const { size, width, height } = mapSize(req.width ?? 1024, req.height ?? 1024);

    const res = await fetchRetry("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: req.prompt,
        size,
        quality: "medium",
        n: 1,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI image API error ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as OpenAiImageResponse;
    const b64 = json.data?.[0]?.b64_json;
    const remoteUrl = json.data?.[0]?.url;

    let buf: Buffer;
    if (b64) {
      buf = Buffer.from(b64, "base64");
    } else if (remoteUrl) {
      const imgRes = await fetchRetry(remoteUrl, {});
      if (!imgRes.ok) throw new Error(`OpenAI image fetch error ${imgRes.status}`);
      buf = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw new Error("OpenAI image API returned no image data");
    }

    const key = `images/openai/${hashKey(req.prompt, size, req.seed ?? 0)}.png`;
    const url = await putObject(key, buf, "image/png");

    return {
      data: { url, width, height, seed: req.seed },
      provider: this.name,
      costMicroUsd: usdToMicro(USD_PER_IMAGE),
      meta: { model: "gpt-image-1", size },
    };
  }
}
