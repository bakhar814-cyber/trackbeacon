// OpenAI LLM provider — uses the Chat Completions API via global fetch.
// Docs: https://platform.openai.com/docs/api-reference/chat
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import type {
  LlmGenerateOptions,
  LlmProvider,
  ProviderResult,
} from "@/lib/providers/types";

// Rough blended price for gpt-4o-class models (per 1M tokens).
// Input ~ $2.50/MTok, output ~ $10/MTok.
const INPUT_USD_PER_MTOK = 2.5;
const OUTPUT_USD_PER_MTOK = 10;

interface OpenAiChoice {
  message?: { content?: string | null };
}
interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}
interface OpenAiResponse {
  choices?: OpenAiChoice[];
  usage?: OpenAiUsage;
}

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = "openai";

  async generate(opts: LlmGenerateOptions): Promise<ProviderResult<string>> {
    const apiKey = config.keys.openai;
    if (!apiKey) throw new Error("OpenAiLlmProvider: OPENAI_API_KEY is not set");

    // OpenAI accepts the system prompt as a regular message.
    const messages: Array<{ role: string; content: string }> = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    for (const m of opts.messages) messages.push({ role: m.role, content: m.content });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.keys.openaiModel,
        temperature: opts.temperature ?? 0.7,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as OpenAiResponse;
    const text = json.choices?.[0]?.message?.content ?? "";

    const inTok = json.usage?.prompt_tokens ?? 0;
    const outTok = json.usage?.completion_tokens ?? 0;
    const usd =
      (inTok / 1_000_000) * INPUT_USD_PER_MTOK +
      (outTok / 1_000_000) * OUTPUT_USD_PER_MTOK;

    return {
      data: text,
      provider: this.name,
      costMicroUsd: usdToMicro(usd),
      meta: { model: config.keys.openaiModel, inputTokens: inTok, outputTokens: outTok },
    };
  }
}
