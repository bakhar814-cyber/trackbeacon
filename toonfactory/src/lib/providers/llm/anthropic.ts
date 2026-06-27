// Anthropic (Claude) LLM provider — uses the Messages API via global fetch.
// Docs: https://docs.anthropic.com/en/api/messages
//
// The whole provider layer is intentionally SDK-free (every provider speaks raw
// HTTP) so providers stay uniform and swappable with zero extra dependencies.
import { config } from "@/lib/config";
import { usdToMicro } from "@/lib/cost";
import type {
  LlmGenerateOptions,
  LlmProvider,
  ProviderResult,
} from "@/lib/providers/types";

// Per-model pricing in USD per 1M tokens (input, output). Current Claude tiers.
// Update here when pricing changes; unknown models fall back to Opus-tier rates.
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-opus-4-6": { in: 5, out: 25 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-fable-5": { in: 10, out: 50 },
};
function priceFor(model: string) {
  return PRICING[model] ?? { in: 5, out: 25 };
}

// Opus 4.7+, Opus 4.8, and Fable/Mythos 5 REMOVED temperature/top_p/top_k —
// sending them returns HTTP 400. Omit sampling params for those models.
function rejectsSamplingParams(model: string): boolean {
  return /opus-4-(7|8)|fable-5|mythos/.test(model);
}

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
  stop_reason?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AnthropicLlmProvider implements LlmProvider {
  readonly name = "anthropic";

  async generate(opts: LlmGenerateOptions): Promise<ProviderResult<string>> {
    const apiKey = config.keys.anthropic;
    if (!apiKey) throw new Error("AnthropicLlmProvider: ANTHROPIC_API_KEY is not set");
    const model = config.keys.anthropicModel;

    // Anthropic separates the system prompt from the message list. There is no
    // response_format/JSON mode and assistant prefills 400 on current models, so
    // JSON is requested via a system instruction + tolerant parsing downstream.
    const system = [
      opts.system,
      opts.json ? "Respond with ONLY valid JSON. No markdown, no prose, no code fences." : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const messages = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: opts.maxTokens ?? 4096,
      ...(system ? { system } : {}),
      messages,
    };
    // Only send temperature on models that still accept it.
    if (opts.temperature !== undefined && !rejectsSamplingParams(model)) {
      body.temperature = opts.temperature;
    }

    const json = await this.post(apiKey, body);

    const text = (json.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");

    if (json.stop_reason === "refusal") {
      throw new Error("Anthropic declined the request (stop_reason=refusal)");
    }

    const inTok = json.usage?.input_tokens ?? 0;
    const outTok = json.usage?.output_tokens ?? 0;
    const price = priceFor(model);
    const usd = (inTok / 1_000_000) * price.in + (outTok / 1_000_000) * price.out;

    return {
      data: text,
      provider: this.name,
      costMicroUsd: usdToMicro(usd),
      meta: { model, inputTokens: inTok, outputTokens: outTok },
    };
  }

  // POST with a request timeout and bounded retries on 429/5xx + network errors.
  private async post(apiKey: string, body: unknown): Promise<AnthropicResponse> {
    const maxAttempts = 4;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120_000);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (res.ok) return (await res.json()) as AnthropicResponse;

        const errText = await res.text();
        // Retry transient statuses; fail fast on 4xx (except 429).
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`Anthropic API ${res.status}: ${errText}`);
          const retryAfter = Number(res.headers.get("retry-after"));
          const backoff = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : Math.min(16_000, 1_000 * 2 ** (attempt - 1));
          if (attempt < maxAttempts) {
            await sleep(backoff);
            continue;
          }
        }
        throw new Error(`Anthropic API error ${res.status}: ${errText}`);
      } catch (err) {
        lastErr = err;
        // Network/abort errors are retryable.
        const retryable = err instanceof Error && /aborted|network|fetch failed|ECONN/i.test(err.message);
        if (attempt < maxAttempts && retryable) {
          await sleep(Math.min(16_000, 1_000 * 2 ** (attempt - 1)));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Anthropic request failed");
  }
}
