// Google Imagen image provider (via the Gemini API predict endpoint).
// Docs: https://ai.google.dev/gemini-api/docs/imagen
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

interface ImagenResponse {
  predictions?: Array<{ bytesBase64Encoded?: string }>;
}

export class GeminiImageProvider implements ImageProvider {
  readonly name = "gemini";

  async generate(req: ImageRequest): Promise<ProviderResult<ImageResult>> {
    const apiKey = config.keys.gemini;
    if (!apiKey) throw new Error("GeminiImageProvider: GEMINI_API_KEY is not set");

    const width = req.width ?? 1024;
    const height = req.height ?? 1024;
    const model = "imagen-3.0-generate-002";
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${model}:predict?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: req.prompt }],
        parameters: {
          sampleCount: 1,
          ...(req.seed != null ? { seed: req.seed } : {}),
          ...(req.negativePrompt ? { negativePrompt: req.negativePrompt } : {}),
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini/Imagen API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as ImagenResponse;
    const b64 = json.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("Imagen API returned no image data");

    const buf = Buffer.from(b64, "base64");
    const key = `images/gemini/${hashKey(req.prompt, width, height, req.seed ?? 0)}.png`;
    const publicUrl = await putObject(key, buf, "image/png");

    return {
      data: { url: publicUrl, width, height, seed: req.seed },
      provider: this.name,
      costMicroUsd: usdToMicro(USD_PER_IMAGE),
      meta: { model },
    };
  }
}
