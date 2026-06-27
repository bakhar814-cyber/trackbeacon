// Deterministic mock animation provider. No real video is produced in mock mode:
// it simply echoes the input image URL as the "clip" URL at the requested
// duration. This keeps the pipeline fully runnable offline.
import type {
  AnimationProvider,
  AnimationRequest,
  ClipResult,
  ProviderResult,
} from "@/lib/providers/types";

export class MockAnimationProvider implements AnimationProvider {
  readonly name = "mock";

  async animate(req: AnimationRequest): Promise<ProviderResult<ClipResult>> {
    return {
      data: { url: req.imageUrl, durationSec: Math.max(1, req.durationSec) },
      provider: this.name,
      costMicroUsd: 0,
      meta: { mock: true, camera: req.motion.camera ?? "static" },
    };
  }
}
