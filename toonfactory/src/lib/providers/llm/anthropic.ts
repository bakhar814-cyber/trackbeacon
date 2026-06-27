// Anthropic (Claude) LLM provider — uses the Messages API via global fetch.
// Docs: https://docs.anthropic.com/en/api/messages
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import type {
  LlmGenerateOptions,
  LlmProvider,
  ProviderResult,
} from "@/lib/providers/types";

// Rough blended price for Claude Opus-class models (per 1M tokens).
// Input ~ $15/MTok, output ~ $75/MTok. Adjust per model if needed.
const INPUT_USD_PER_MTOK = 15;
const OUTPUT_USD_PER_MTOK = 75;

interface AnthropicContentBlock {
  type: string;
  text?: string;
}
interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}
interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  usage?: AnthropicUsage;
}

export class AnthropicLlmProvider implements LlmProvider {
  readonly name = "anthropic";

  async generate(opts: LlmGenerateOptions): Promise<ProviderResult<string>> {
    const apiKey = config.keys.anthropic;
    if (!apiKey) throw new Error("AnthropicLlmProvider: ANTHROPIC_API_KEY is not set");

    // Anthropic separates the system prompt from the message list.
    const system = [opts.system, opts.json ? "Respond with only valid JSON, no prose." : ""]
      .filter(Boolean)
      .join("\n\n");

    const messages = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.keys.anthropicModel,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        ...(system ? { system } : {}),
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as AnthropicResponse;
    const text = (json.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");

    const inTok = json.usage?.input_tokens ?? 0;
    const outTok = json.usage?.output_tokens ?? 0;
    const usd =
      (inTok / 1_000_000) * INPUT_USD_PER_MTOK +
      (outTok / 1_000_000) * OUTPUT_USD_PER_MTOK;

    return {
      data: text,
      provider: this.name,
      costMicroUsd: usdToMicro(usd),
      meta: { model: config.keys.anthropicModel, inputTokens: inTok, outputTokens: outTok },
    };
  }
}
