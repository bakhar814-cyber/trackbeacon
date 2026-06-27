// LLM provider selector. Picks a concrete provider based on env config, falling
// back to the deterministic mock whenever the chosen provider has no key.
import { config, effectiveProvider } from "@/lib/config";
import type { LlmProvider } from "@/lib/providers/types";
import { AnthropicLlmProvider } from "./anthropic";
import { OpenAiLlmProvider } from "./openai";
import { GeminiLlmProvider } from "./gemini";
import { MockLlmProvider } from "./mock";

export function getLlmProvider(): LlmProvider {
  const hasKey = !!(config.keys.anthropic || config.keys.openai || config.keys.gemini);
  const chosen = effectiveProvider("llm", hasKey);

  switch (chosen) {
    case "anthropic":
      if (config.keys.anthropic) return new AnthropicLlmProvider();
      break;
    case "openai":
      if (config.keys.openai) return new OpenAiLlmProvider();
      break;
    case "gemini":
      if (config.keys.gemini) return new GeminiLlmProvider();
      break;
  }
  return new MockLlmProvider();
}
