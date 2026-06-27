// Google Gemini LLM provider — uses the generateContent API via global fetch.
// Docs: https://ai.google.dev/api/generate-content
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import { fetchRetry } from "@/lib/providers/http";
import type {
  LlmGenerateOptions,
  LlmProvider,
  ProviderResult,
} from "@/lib/providers/types";

// Per-model pricing in USD per 1M tokens (input, output). Unknown models fall
// back to 1.5-pro rates. (Long-context tiers cost more; this is a base estimate.)
const PRICING: Record<string, { in: number; out: number }> = {
  "gemini-1.5-pro": { in: 1.25, out: 5 },
  "gemini-1.5-flash": { in: 0.075, out: 0.3 },
  "gemini-2.0-flash": { in: 0.1, out: 0.4 },
  "gemini-2.5-pro": { in: 1.25, out: 10 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
};
function priceFor(model: string) {
  return PRICING[model] ?? { in: 1.25, out: 5 };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
}

export class GeminiLlmProvider implements LlmProvider {
  readonly name = "gemini";

  async generate(opts: LlmGenerateOptions): Promise<ProviderResult<string>> {
    const apiKey = config.keys.gemini;
    if (!apiKey) throw new Error("GeminiLlmProvider: GEMINI_API_KEY is not set");
    const model = config.keys.geminiModel;
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // Gemini maps "assistant" -> "model" and uses a separate systemInstruction.
    const contents = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const system = [opts.system, opts.json ? "Respond with only valid JSON, no prose." : ""]
      .filter(Boolean)
      .join("\n\n");

    const res = await fetchRetry(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
          ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as GeminiResponse;
    if (json.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the prompt: ${json.promptFeedback.blockReason}`);
    }
    const cand = json.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text && cand?.finishReason && cand.finishReason !== "STOP") {
      throw new Error(`Gemini returned no text (finishReason=${cand.finishReason})`);
    }

    const inTok = json.usageMetadata?.promptTokenCount ?? 0;
    const outTok = json.usageMetadata?.candidatesTokenCount ?? 0;
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
