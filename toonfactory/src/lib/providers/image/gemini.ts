// Google Imagen image provider (via the Gemini API predict endpoint).
// Docs: https://ai.google.dev/gemini-api/docs/imagen
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

const USD_PER_IMAGE = 0.04;

// Imagen sizes via aspectRatio (not width/height). Map the request to the
// nearest supported ratio and report back representative pixel dimensions.
function mapAspect(w: number, h: number): { aspectRatio: string; width: number; height: number } {
  const r = w / h;
  if (r > 1.55) return { aspectRatio: "16:9", width: 1408, height: 768 };
  if (r > 1.15) return { aspectRatio: "4:3", width: 1280, height: 960 };
  if (r < 0.65) return { aspectRatio: "9:16", width: 768, height: 1408 };
  if (r < 0.87) return { aspectRatio: "3:4", width: 960, height: 1280 };
  return { aspectRatio: "1:1", width: 1024, height: 1024 };
}

interface ImagenResponse {
  predictions?: Array<{ bytesBase64Encoded?: string }>;
}

export class GeminiImageProvider implements ImageProvider {
  readonly name = "gemini";

  async generate(req: ImageRequest): Promise<ProviderResult<ImageResult>> {
    const apiKey = config.keys.gemini;
    if (!apiKey) throw new Error("GeminiImageProvider: GEMINI_API_KEY is not set");

    const { aspectRatio, width, height } = mapAspect(req.width ?? 1024, req.height ?? 1024);
    const model = "imagen-3.0-generate-002";
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${encodeURIComponent(apiKey)}`;

    const res = await fetchRetry(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: req.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
          // A seed requires the SynthID watermark to be disabled, otherwise the
          // API returns 400. Only send the pair together.
          ...(req.seed != null ? { seed: req.seed, addWatermark: false } : {}),
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini/Imagen API error ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as ImagenResponse;
    const b64 = json.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("Imagen API returned no image data");

    const buf = Buffer.from(b64, "base64");
    const key = `images/gemini/${hashKey(req.prompt, aspectRatio, req.seed ?? 0)}.png`;
    const publicUrl = await putObject(key, buf, "image/png");

    return {
      data: { url: publicUrl, width, height, seed: req.seed },
      provider: this.name,
      costMicroUsd: usdToMicro(USD_PER_IMAGE),
      meta: { model, aspectRatio },
    };
  }
}
