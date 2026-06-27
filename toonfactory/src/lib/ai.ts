import { getLlmProvider } from "./providers/registry";
import { recordCost } from "./cost";
import type { LlmMessage } from "./providers/types";

// Convenience wrappers around the active LLM provider used by the pipeline.

export async function generateText(args: {
  episodeId?: string;
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const llm = getLlmProvider();
  const messages: LlmMessage[] = [{ role: "user", content: args.user }];
  const res = await llm.generate({
    system: args.system,
    messages,
    temperature: args.temperature ?? 0.8,
    maxTokens: args.maxTokens ?? 4000,
  });
  if (res.costMicroUsd > 0) {
    await recordCost({
      episodeId: args.episodeId,
      provider: res.provider,
      category: "llm",
      costMicroUsd: res.costMicroUsd,
    });
  }
  return res.data;
}

// Calls the LLM in JSON mode and parses the result, tolerating code fences.
export async function generateJson<T>(args: {
  episodeId?: string;
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const llm = getLlmProvider();
  const res = await llm.generate({
    system: args.system,
    messages: [{ role: "user", content: args.user }],
    temperature: args.temperature ?? 0.7,
    maxTokens: args.maxTokens ?? 6000,
    json: true,
  });
  if (res.costMicroUsd > 0) {
    await recordCost({
      episodeId: args.episodeId,
      provider: res.provider,
      category: "llm",
      costMicroUsd: res.costMicroUsd,
    });
  }
  return parseJsonLoose<T>(res.data);
}

export function parseJsonLoose<T>(raw: string): T {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Fall back to the first {...} or [...] block if there's surrounding prose.
  if (!text.startsWith("{") && !text.startsWith("[")) {
    const obj = text.indexOf("{");
    const arr = text.indexOf("[");
    const start =
      obj === -1 ? arr : arr === -1 ? obj : Math.min(obj, arr);
    if (start >= 0) text = text.slice(start);
  }
  return JSON.parse(text) as T;
}
