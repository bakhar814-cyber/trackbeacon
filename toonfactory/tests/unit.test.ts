import { describe, it, expect } from "vitest";
import { usdToMicro, microToUsd } from "@/lib/cost";
import { parseJsonLoose } from "@/lib/ai";
import { scoreThumbnail } from "@/lib/thumbnail/score";
import { continuityToPrompt, type ContinuityContext } from "@/lib/story/manager";
import { PIPELINE_STAGES, STAGE_LABELS, STAGE_STATUS } from "@/lib/pipeline/stages";

describe("cost helpers", () => {
  it("round-trips usd <-> micro", () => {
    expect(usdToMicro(1)).toBe(1_000_000);
    expect(microToUsd(2_500_000)).toBe(2.5);
    expect(usdToMicro(0.04)).toBe(40_000);
  });
});

describe("parseJsonLoose", () => {
  it("parses plain JSON", () => {
    expect(parseJsonLoose<{ a: number }>('{"a":1}').a).toBe(1);
  });
  it("strips ```json fences", () => {
    const out = parseJsonLoose<{ ok: boolean }>("```json\n{\"ok\":true}\n```");
    expect(out.ok).toBe(true);
  });
  it("recovers JSON embedded in prose", () => {
    const out = parseJsonLoose<{ n: number }>('Sure! Here you go: {"n":42} cheers');
    expect(out.n).toBe(42);
  });
});

describe("thumbnail scoring", () => {
  it("is deterministic for the same prompt + seed", () => {
    const a = scoreThumbnail("bright close-up happy face big text", 7);
    const b = scoreThumbnail("bright close-up happy face big text", 7);
    expect(a.score).toBe(b.score);
  });
  it("rewards emotional, bright, close-up, big-text prompts", () => {
    const strong = scoreThumbnail(
      "close-up surprised happy face, bright vivid colors, big bold text",
      5,
    );
    const weak = scoreThumbnail("a plain wide landscape", 5);
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeLessThanOrEqual(100);
  });
});

describe("continuity prompt", () => {
  it("includes characters, canon, and the next episode number", () => {
    const ctx: ContinuityContext = {
      seriesId: "s1",
      title: "Pip & Bramble",
      logline: "Two friends",
      worldRules: { tone: "gentle" },
      artStyle: { medium: "2d" },
      characters: [
        { id: "c1", name: "Pip", role: "protagonist", age: "6", personality: {}, designToken: "a small fox" },
      ],
      locations: [{ id: "l1", name: "Woods", description: "green" }],
      relationships: [{ a: "Pip", b: "Bramble", kind: "friend", status: "close" }],
      recentCanon: [{ category: "event", summary: "found the lantern" }],
      lastEpisode: { number: 4, title: "The Lantern", cliffhanger: "a map appears", nextSetup: "follow it" },
      nextNumber: 5,
    };
    const p = continuityToPrompt(ctx);
    expect(p).toContain("Pip");
    expect(p).toContain("found the lantern");
    expect(p).toContain("episode #5");
    expect(p).toContain("a map appears");
  });
});

describe("pipeline stage definitions", () => {
  it("has 12 ordered stages ending in upload, each with a label + status", () => {
    expect(PIPELINE_STAGES[0]).toBe("plan");
    expect(PIPELINE_STAGES.at(-1)).toBe("upload");
    expect(PIPELINE_STAGES).toHaveLength(12);
    for (const s of PIPELINE_STAGES) {
      expect(STAGE_LABELS[s]).toBeTruthy();
      expect(STAGE_STATUS[s]).toBeTruthy();
    }
  });
});
