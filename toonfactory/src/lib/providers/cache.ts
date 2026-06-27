import { prisma } from "../db";
import { recordCost } from "../cost";
import { hashKey } from "../storage";
import type { AssetKind } from "@prisma/client";
import type { ProviderResult } from "./types";

// Wraps any asset-producing provider call with a content-addressed cache backed
// by the Asset table. Identical requests (same cacheKey) reuse the stored URL
// and incur zero additional provider cost — the core of cost optimization.
export async function withAssetCache<T extends { url: string }>(args: {
  kind: AssetKind;
  episodeId?: string;
  costCategory: "image" | "voice" | "music" | "animation" | "video";
  keyParts: Array<string | number | object>;
  prompt?: string;
  produce: () => Promise<ProviderResult<T>>;
}): Promise<{ url: string; cached: boolean; result?: T }> {
  const cacheKey = hashKey(args.kind, ...args.keyParts);

  const existing = await prisma.asset.findUnique({ where: { cacheKey } });
  if (existing) {
    return { url: existing.url, cached: true };
  }

  const res = await args.produce();

  await prisma.asset.create({
    data: {
      kind: args.kind,
      episodeId: args.episodeId,
      provider: res.provider,
      cacheKey,
      prompt: args.prompt ?? "",
      url: res.data.url,
      meta: (res.meta ?? {}) as object,
      costMicroUsd: res.costMicroUsd,
    },
  });

  if (res.costMicroUsd > 0) {
    await recordCost({
      episodeId: args.episodeId,
      provider: res.provider,
      category: args.costCategory,
      costMicroUsd: res.costMicroUsd,
    });
  }

  return { url: res.data.url, cached: false, result: res.data };
}
