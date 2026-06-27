// Live wiring check for the active image provider.
//
//   npm run smoke:image                                   # mock (no key)
//   PIPELINE_MODE=live IMAGE_PROVIDER=openai OPENAI_API_KEY=sk-... npm run smoke:image
//   PIPELINE_MODE=live IMAGE_PROVIDER=gemini GEMINI_API_KEY=...     npm run smoke:image
//
// Generates ONE 16:9 frame, stores it, and prints the URL, dimensions, and cost.
import { loadDotenv } from "./_env";

loadDotenv();

async function main() {
  const { config } = await import("@/lib/config");
  const { getImageProvider } = await import("@/lib/providers/registry");
  const { microToUsd } = await import("@/lib/cost");

  const provider = getImageProvider();
  console.log(`mode=${config.mode}  IMAGE_PROVIDER=${config.providers.image}  -> using "${provider.name}"`);

  const t0 = Date.now();
  const res = await provider.generate({
    prompt:
      "Soft 2D storybook illustration of a cheerful fox kit and a gentle bear cub waving in a sunny meadow, warm pastels, thick friendly outlines, 16:9, no text",
    width: 1280,
    height: 720,
    seed: 42,
  });
  const ms = Date.now() - t0;

  console.log("\n--- result ---");
  console.log("url:", res.data.url);
  console.log("dimensions:", `${res.data.width}x${res.data.height}`);
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
