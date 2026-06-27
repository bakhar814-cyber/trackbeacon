// Live wiring check for the active LLM provider.
//
//   npm run smoke:llm
//
// In mock mode (default) this proves the wiring with the deterministic mock.
// To verify a REAL provider end-to-end:
//   PIPELINE_MODE=live LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... npm run smoke:llm
// It makes ONE tiny request, prints the reply, the resolved model, and the
// measured cost — so you can confirm credentials and pricing before producing
// a full episode in live mode.
import { config } from "@/lib/config";
import { getLlmProvider } from "@/lib/providers/registry";
import { microToUsd } from "@/lib/cost";

async function main() {
  const provider = getLlmProvider();
  console.log(`mode=${config.mode}  LLM_PROVIDER=${config.providers.llm}  -> using "${provider.name}"`);
  if (provider.name === "mock") {
    console.log("Running against the deterministic mock (no API key needed).");
    console.log("Set PIPELINE_MODE=live and the provider key to hit the real API.");
  }

  const t0 = Date.now();
  const res = await provider.generate({
    system: "You are a friendly kids-cartoon writing assistant. Keep it short.",
    messages: [{ role: "user", content: "In one sentence, greet Pip the fox and Bramble the bear." }],
    maxTokens: 200,
    temperature: 0.7,
  });
  const ms = Date.now() - t0;

  console.log("\n--- reply ---\n" + res.data.trim());
  console.log("\n--- meta ---");
  console.log("provider:", res.provider);
  console.log("meta:", JSON.stringify(res.meta ?? {}));
  console.log("cost: $" + microToUsd(res.costMicroUsd).toFixed(6));
  console.log("latency: " + ms + "ms");
  console.log("\nOK ✅");
}

main().catch((e) => {
  console.error("\nSMOKE FAILED ❌");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
