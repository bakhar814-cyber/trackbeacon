// Image provider selector.
import { config, effectiveProvider } from "@/lib/config";
import type { ImageProvider } from "@/lib/providers/types";
import { OpenAiImageProvider } from "./openai";
import { GeminiImageProvider } from "./gemini";
import { StableDiffusionImageProvider } from "./stable-diffusion";
import { FluxImageProvider } from "./flux";
import { MockImageProvider } from "./mock";

export function getImageProvider(): ImageProvider {
  const hasKey = !!(
    config.keys.openai ||
    config.keys.gemini ||
    config.keys.stability ||
    config.keys.flux
  );
  const chosen = effectiveProvider("image", hasKey);

  switch (chosen) {
    case "openai":
      if (config.keys.openai) return new OpenAiImageProvider();
      break;
    case "gemini":
      if (config.keys.gemini) return new GeminiImageProvider();
      break;
    case "stable-diffusion":
      if (config.keys.stability) return new StableDiffusionImageProvider();
      break;
    case "flux":
      if (config.keys.flux) return new FluxImageProvider();
      break;
  }
  return new MockImageProvider();
}
