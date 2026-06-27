// Live wiring check for the active voice provider.
//
//   npm run smoke:voice                                        # mock (no key)
//   PIPELINE_MODE=live VOICE_PROVIDER=elevenlabs ELEVENLABS_API_KEY=... npm run smoke:voice
//
// Synthesizes ONE short line, stores the audio, and prints the URL, duration,
// and cost. With ElevenLabs it also lists a few available voice ids so you can
// map them onto your characters.
import { loadDotenv } from "./_env";

loadDotenv();

async function main() {
  const { config } = await import("@/lib/config");
  const { getVoiceProvider } = await import("@/lib/providers/registry");
  const { microToUsd } = await import("@/lib/cost");

  const provider = getVoiceProvider();
  console.log(`mode=${config.mode}  VOICE_PROVIDER=${config.providers.voice}  -> using "${provider.name}"`);

  if (provider.listVoices) {
    try {
      const voices = await provider.listVoices();
      console.log(`\navailable voices (${voices.length}):`);
      for (const v of voices.slice(0, 8)) console.log(`  ${v.id}  ${v.label}`);
    } catch {
      // listing is best-effort
    }
  }

  const t0 = Date.now();
  const res = await provider.synthesize({
    text: "Hi friends! I'm Pip the fox, and this is my best buddy Bramble. Let's go on an adventure!",
    voiceId: config.keys.elevenlabsDefaultVoice,
    emotion: "cheerful",
  });
  const ms = Date.now() - t0;

  console.log("\n--- result ---");
  console.log("url:", res.data.url);
  console.log("durationSec:", res.data.durationSec);
  console.log("cost: $" + microToUsd(res.costMicroUsd).toFixed(6));
  console.log("latency: " + ms + "ms");
  console.log("\nOK ✅");
}

main().catch((e) => {
  console.error("\nSMOKE FAILED ❌");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
