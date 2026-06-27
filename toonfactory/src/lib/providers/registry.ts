// Single entry point the pipeline uses to obtain providers. Each capability
// folder owns its own selector (chosen via env in src/lib/config.ts), so adding
// or swapping a provider never touches the pipeline code.

import { getLlmProvider } from "./llm";
import { getImageProvider } from "./image";
import { getVoiceProvider } from "./voice";
import { getMusicProvider } from "./music";
import { getAnimationProvider } from "./animation";
import { getVideoProvider } from "./video";

export const providers = {
  llm: getLlmProvider,
  image: getImageProvider,
  voice: getVoiceProvider,
  music: getMusicProvider,
  animation: getAnimationProvider,
  video: getVideoProvider,
};

export {
  getLlmProvider,
  getImageProvider,
  getVoiceProvider,
  getMusicProvider,
  getAnimationProvider,
  getVideoProvider,
};
