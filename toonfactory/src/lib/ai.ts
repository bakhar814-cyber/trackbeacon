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

  // Fast path: already clean JSON.
  try {
    return JSON.parse(text) as T;
  } catch {
    // Fall through to extracting the first balanced object/array from prose.
  }

  const obj = text.indexOf("{");
  const arr = text.indexOf("[");
  const start = obj === -1 ? arr : arr === -1 ? obj : Math.min(obj, arr);
  if (start < 0) return JSON.parse(text) as T; // let it throw with the original error

  const slice = extractBalanced(text, start);
  return JSON.parse(slice) as T;
}

// Returns the substring from `start` through the matching close of the opening
// brace/bracket, ignoring braces inside strings. Tolerates trailing prose.
function extractBalanced(text: string, start: number): string {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start); // unbalanced; let JSON.parse surface the error
}
