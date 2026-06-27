import { prisma } from "../db";
import { config } from "../config";
import { getOrCreateSeries } from "../story/manager";

// Ensure the series has a usable cast + locations on first run, so a fresh
// deploy produces a coherent, consistent series with NO manual seed step.
// Non-destructive: only creates the default cast when none exists yet (so it
// never clobbers characters you've customized).
export async function ensureSeriesBootstrapped(): Promise<string> {
  const series = await getOrCreateSeries();

  const haveChars = await prisma.character.count({ where: { seriesId: series.id } });
  if (haveChars === 0) {
    await prisma.character.createMany({
      data: [
        {
          seriesId: series.id,
          name: "Pip",
          role: "protagonist",
          age: "6",
          appearance: { species: "fox kit", fur: "warm orange", eyes: "bright green", palette: ["#E8743B", "#FFF3E0", "#2E7D32"] },
          clothing: { item: "tiny teal scarf" },
          personality: { traits: ["curious", "brave", "kind"] },
          voiceProfile: { provider: "elevenlabs", voiceId: config.keys.elevenlabsDefaultVoice, pitch: "high" },
          designToken:
            "Pip, a small curious fox kit with warm orange fur, a fluffy tail, bright green eyes, and a tiny teal scarf",
        },
        {
          seriesId: series.id,
          name: "Bramble",
          role: "protagonist",
          age: "7",
          appearance: { species: "bear cub", fur: "soft brown", eyes: "gentle amber", palette: ["#8D6E63", "#FFE0B2", "#5D4037"] },
          clothing: { item: "yellow rain boots" },
          personality: { traits: ["gentle", "patient", "loyal"] },
          voiceProfile: { provider: "elevenlabs", voiceId: config.keys.elevenlabsDefaultVoice, pitch: "low" },
          designToken:
            "Bramble, a gentle round bear cub with soft brown fur, kind amber eyes, and bright yellow rain boots",
        },
        {
          seriesId: series.id,
          name: "Olive",
          role: "supporting",
          age: "6",
          appearance: { species: "owlet", feathers: "speckled grey", eyes: "big golden", palette: ["#9E9E9E", "#FFF8E1", "#FBC02D"] },
          clothing: { item: "round glasses" },
          personality: { traits: ["clever", "bookish", "helpful"] },
          voiceProfile: { provider: "elevenlabs", voiceId: config.keys.elevenlabsDefaultVoice, pitch: "mid" },
          designToken: "Olive, a clever little owlet with speckled grey feathers, big golden eyes, and round glasses",
        },
      ],
    });

    await prisma.location.createMany({
      data: [
        { seriesId: series.id, name: "Whispering Woods", description: "a cozy sun-dappled forest of tall friendly trees", visualSpec: { palette: ["#2E7D32", "#A5D6A7"] } },
        { seriesId: series.id, name: "Sunny Meadow", description: "a bright wildflower meadow on a gentle hill", visualSpec: { palette: ["#FFD54F", "#AED581"] } },
        { seriesId: series.id, name: "Crystal Creek", description: "a clear babbling creek with smooth stepping stones", visualSpec: { palette: ["#4FC3F7", "#B3E5FC"] } },
      ],
    });
  }

  return series.id;
}
