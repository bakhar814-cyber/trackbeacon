import { describe, it, expect } from "vitest";
import {
  getLlmProvider,
  getImageProvider,
  getVoiceProvider,
  getMusicProvider,
  getAnimationProvider,
  getVideoProvider,
} from "@/lib/providers/registry";
import { parseJsonLoose } from "@/lib/ai";

// With PIPELINE_MODE=mock (set in vitest.config.ts) every selector resolves to
// its deterministic mock implementation — no API keys, no network.

describe("provider selection (mock mode)", () => {
  it("returns mock providers for every capability", () => {
    expect(getLlmProvider().name).toBe("mock");
    expect(getImageProvider().name).toBe("mock");
    expect(getVoiceProvider().name).toBe("mock");
    expect(getMusicProvider().name).toBe("mock");
    expect(getAnimationProvider().name).toBe("mock");
    expect(getVideoProvider().name).toBe("mock");
  });
});

describe("mock LLM produces correctly-shaped JSON", () => {
  it("returns a full EpisodeScript with dialogue", async () => {
    const res = await getLlmProvider().generate({
      system: "You are a master children's TV writer. Reply ONLY with JSON.",
      messages: [{ role: "user", content: "Write the full episode with scenes and dialogue." }],
      json: true,
    });
    const script = parseJsonLoose<any>(res.data);
    expect(script.title).toBeTruthy();
    expect(script.hook).toBeTruthy();
    expect(Array.isArray(script.scenes)).toBe(true);
    expect(script.scenes.length).toBeGreaterThanOrEqual(6);
    const s0 = script.scenes[0];
    expect(s0).toHaveProperty("narration");
    expect(s0.dialogue[0]).toHaveProperty("character");
    expect(s0.dialogue[0]).toHaveProperty("line");
    expect(script.cliffhanger).toBeTruthy();
    expect(Array.isArray(script.canon)).toBe(true);
    expect(res.costMicroUsd).toBe(0);
  });

  it("returns complete SEO", async () => {
    const res = await getLlmProvider().generate({
      system: "You are a YouTube SEO expert. Reply ONLY with JSON.",
      messages: [{ role: "user", content: "Return JSON with title, description, tags, hashtags, keywords." }],
      json: true,
    });
    const seo = parseJsonLoose<any>(res.data);
    expect(seo.title).toBeTruthy();
    expect(seo.description.length).toBeGreaterThan(40);
    expect(seo.tags.length).toBeGreaterThanOrEqual(10);
    expect(seo.hashtags.every((h: string) => h.startsWith("#"))).toBe(true);
  });

  it("returns an episode premise for planning", async () => {
    const res = await getLlmProvider().generate({
      system: "You are the showrunner. Reply ONLY with JSON.",
      messages: [{ role: "user", content: "Plan the next episode. Return workingTitle and premise." }],
      json: true,
    });
    const plan = parseJsonLoose<any>(res.data);
    expect(plan.workingTitle).toBeTruthy();
    expect(plan.premise.length).toBeGreaterThan(40);
  });
});

describe("mock media providers", () => {
  it("image returns a stored URL with dimensions", async () => {
    const res = await getImageProvider().generate({ prompt: "a fox", width: 1280, height: 720 });
    expect(res.data.url).toContain("/api/storage/");
    expect(res.data.width).toBe(1280);
    expect(res.data.height).toBe(720);
  });

  it("voice duration scales with word count", async () => {
    const short = await getVoiceProvider().synthesize({ text: "Hi there.", voiceId: "v1" });
    const long = await getVoiceProvider().synthesize({
      text: "This is a much longer sentence with many more words to speak aloud clearly.",
      voiceId: "v1",
    });
    expect(long.data.durationSec).toBeGreaterThan(short.data.durationSec);
    expect(short.data.durationSec).toBeGreaterThanOrEqual(1);
  });

  it("music returns the requested duration", async () => {
    const res = await getMusicProvider().generate({ mood: "calm", durationSec: 12, kind: "bgm" });
    expect(res.data.durationSec).toBeGreaterThan(0);
    expect(res.data.url).toContain("/api/storage/");
  });

  it("animation returns a clip url", async () => {
    const res = await getAnimationProvider().animate({
      imageUrl: "http://localhost:3000/api/storage/x.svg",
      motion: { camera: "zoom-in" },
      durationSec: 6,
    });
    expect(res.data.url).toBeTruthy();
    expect(res.data.durationSec).toBe(6);
  });
});
