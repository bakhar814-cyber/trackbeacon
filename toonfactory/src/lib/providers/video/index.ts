// Video provider selector.
import { config, effectiveProvider } from "@/lib/config";
import type { VideoProvider } from "@/lib/providers/types";
import { FfmpegVideoProvider } from "./ffmpeg";
import { ShotstackVideoProvider } from "./shotstack";
import { MockVideoProvider } from "./mock";

export function getVideoProvider(): VideoProvider {
  // ffmpeg is a local tool and needs no API key; shotstack needs one.
  const isFfmpeg = config.providers.video === "ffmpeg";
  const hasKey = isFfmpeg || !!config.keys.shotstack;
  const chosen = effectiveProvider("video", hasKey);

  switch (chosen) {
    case "ffmpeg":
      return new FfmpegVideoProvider();
    case "shotstack":
      if (config.keys.shotstack) return new ShotstackVideoProvider();
      break;
  }
  return new MockVideoProvider();
}
