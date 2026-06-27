import { prisma } from "./db";

// All money is tracked in micro-dollars (integer 1e-6 USD) to avoid float drift.
export const usdToMicro = (usd: number) => Math.round(usd * 1_000_000);
export const microToUsd = (micro: number) => micro / 1_000_000;

export interface CostInput {
  episodeId?: string;
  provider: string;
  category: "llm" | "image" | "voice" | "music" | "animation" | "video" | "upload";
  units?: number;
  unit?: string;
  costMicroUsd: number;
}

// Records a cost event and rolls it up onto the episode total.
export async function recordCost(input: CostInput): Promise<void> {
  await prisma.costEvent.create({
    data: {
      episodeId: input.episodeId,
      provider: input.provider,
      category: input.category,
      units: input.units ?? 0,
      unit: input.unit ?? "",
      costMicroUsd: input.costMicroUsd,
    },
  });
  if (input.episodeId && input.costMicroUsd > 0) {
    await prisma.episode.update({
      where: { id: input.episodeId },
      data: { costMicroUsd: { increment: input.costMicroUsd } },
    });
  }
}
