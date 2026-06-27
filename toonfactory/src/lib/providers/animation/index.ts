// Animation provider selector.
import { config, effectiveProvider } from "@/lib/config";
import type { AnimationProvider } from "@/lib/providers/types";
import { RunwayAnimationProvider } from "./runway";
import { KlingAnimationProvider } from "./kling";
import { MockAnimationProvider } from "./mock";

export function getAnimationProvider(): AnimationProvider {
  const hasKey = !!(config.keys.runway || config.keys.kling);
  const chosen = effectiveProvider("animation", hasKey);

  switch (chosen) {
    case "runway":
      if (config.keys.runway) return new RunwayAnimationProvider();
      break;
    case "kling":
      if (config.keys.kling) return new KlingAnimationProvider();
      break;
  }
  return new MockAnimationProvider();
}
