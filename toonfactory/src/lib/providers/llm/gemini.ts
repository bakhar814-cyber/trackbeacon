// Google Gemini LLM provider — uses the generateContent API via global fetch.
// Docs: https://ai.google.dev/api/generate-content
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import type {
  LlmGenerateOptions,
  LlmProvider,
  ProviderResult,
} from "@/lib/providers/types";

// Rough blended price for gemini-1.5-pro-class models (per 1M tokens).
// Input ~ $1.25/MTok, output ~ $5/MTok.
const INPUT_USD_PER_MTOK = 1.25;
const OUTPUT_USD_PER_MTOK = 5;

interface GeminiPart {
  text?: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}
interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
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

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as GeminiResponse;
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");

    const inTok = json.usageMetadata?.promptTokenCount ?? 0;
    const outTok = json.usageMetadata?.candidatesTokenCount ?? 0;
    const usd =
      (inTok / 1_000_000) * INPUT_USD_PER_MTOK +
      (outTok / 1_000_000) * OUTPUT_USD_PER_MTOK;

    return {
      data: text,
      provider: this.name,
      costMicroUsd: usdToMicro(usd),
      meta: { model, inputTokens: inTok, outputTokens: outTok },
    };
  }
}
