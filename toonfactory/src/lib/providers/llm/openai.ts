// OpenAI LLM provider — uses the Chat Completions API via global fetch.
// Docs: https://platform.openai.com/docs/api-reference/chat
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import { fetchRetry } from "@/lib/providers/http";
import type {
  LlmGenerateOptions,
  LlmProvider,
  ProviderResult,
} from "@/lib/providers/types";

// Per-model pricing in USD per 1M tokens (input, output). Unknown models fall
// back to gpt-4o rates.
const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4.1": { in: 2, out: 8 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "o3": { in: 2, out: 8 },
  "o4-mini": { in: 1.1, out: 4.4 },
};
function priceFor(model: string) {
  return PRICING[model] ?? { in: 2.5, out: 10 };
}

// Reasoning models (o-series, gpt-5*) reject `temperature` and use
// `max_completion_tokens` instead of `max_tokens`.
function isReasoningModel(model: string): boolean {
  return /^o\d|^gpt-5/.test(model);
}

interface OpenAiChoice {
  message?: { content?: string | null };
}
interface OpenAiResponse {
  choices?: OpenAiChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = "openai";

  async generate(opts: LlmGenerateOptions): Promise<ProviderResult<string>> {
    const apiKey = config.keys.openai;
    if (!apiKey) throw new Error("OpenAiLlmProvider: OPENAI_API_KEY is not set");
    const model = config.keys.openaiModel;
    const reasoning = isReasoningModel(model);

    // OpenAI takes the system prompt as a message. json_object mode requires the
    // literal word "json" somewhere in the prompt, so ensure it's present.
    const sys = [opts.system, opts.json ? "Respond with ONLY valid JSON." : ""]
      .filter(Boolean)
      .join("\n\n");
    const messages: Array<{ role: string; content: string }> = [];
    if (sys) messages.push({ role: "system", content: sys });
    for (const m of opts.messages) messages.push({ role: m.role, content: m.content });

    const body: Record<string, unknown> = {
      model,
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    };
    if (!reasoning && opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.maxTokens) {
      if (reasoning) body.max_completion_tokens = opts.maxTokens;
      else body.max_tokens = opts.maxTokens;
    }

    const res = await fetchRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as OpenAiResponse;
    const text = json.choices?.[0]?.message?.content ?? "";

    const inTok = json.usage?.prompt_tokens ?? 0;
    const outTok = json.usage?.completion_tokens ?? 0;
    const price = priceFor(model);
    const usd = (inTok / 1_000_000) * price.in + (outTok / 1_000_000) * price.out;

    return {
      data: text,
      provider: this.name,
      costMicroUsd: usdToMicro(usd),
      meta: { model, inputTokens: inTok, outputTokens: outTok },
    };
  }
}
