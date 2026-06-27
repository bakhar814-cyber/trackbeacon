// Video provider selector.
import { config, effectiveProvider } from "@/lib/config";
import type { VideoProvider } from "@/lib/providers/types";
import { FfmpegVideoProvider } from "./ffmpeg";
import { ShotstackVideoProvider } from "./shotstack";
import { MockVideoProvider } from "./mock";

export function getVideoProvider(): VideoProvider {
  // ffmpeg is a free local tool (no API key, no external cost), so it is honored
  // even in mock mode — letting you render real MP4s without going fully live.
  // If the ffmpeg binary is absent, assemble() throws a clear, actionable error.
  if (config.providers.video === "ffmpeg") return new FfmpegVideoProvider();

  const chosen = effectiveProvider("video", !!config.keys.shotstack);
  switch (chosen) {
    case "shotstack":
      if (config.keys.shotstack) return new ShotstackVideoProvider();
      break;
  }
  return new MockVideoProvider();
}
