// Deterministic mock LLM provider. Produces plausible, *correctly-shaped*
// structured content with zero credentials so the entire pipeline is runnable
// in mock mode. When `opts.json` is true it ALWAYS returns strictly parseable
// JSON whose shape matches what the requesting pipeline stage expects. It keys
// off both the system prompt and the last user message so detection is robust.
import { hashKey } from "@/lib/storage";
import type {
  LlmGenerateOptions,
  LlmProvider,
  ProviderResult,
} from "@/lib/providers/types";

// A tiny seeded PRNG so the same prompt yields the same output every run.
function seededInt(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return min + (h % Math.max(1, max - min + 1));
}

function lastUserText(opts: LlmGenerateOptions): string {
  for (let i = opts.messages.length - 1; i >= 0; i--) {
    if (opts.messages[i].role === "user") return opts.messages[i].content;
  }
  return opts.messages.map((m) => m.content).join(" ");
}

const NAMES = ["Pip", "Bramble", "Olive", "Hazel", "Rusty"];
const LOCATIONS = [
  "Whispering Woods",
  "Sunny Meadow",
  "Crystal Creek",
  "Old Oak Library",
  "Bramble's Den",
];
const MOODS = ["cheerful", "curious", "tender", "adventurous", "playful", "calm"];

// Full EpisodeScript matching src/lib/pipeline/schema.ts.
function buildScript(seed: string): unknown {
  const sceneCount = 6 + seededInt(seed, 0, 2);
  const scenes = Array.from({ length: sceneCount }, (_, i) => {
    const loc = LOCATIONS[i % LOCATIONS.length];
    const a = NAMES[i % NAMES.length];
    const b = NAMES[(i + 1) % NAMES.length];
    return {
      index: i,
      heading: `Scene ${i + 1}: ${loc}`,
      location: loc,
      characters: [a, b],
      action: `${a} and ${b} explore ${loc} and discover a small problem they can solve together.`,
      narration: `In the gentle light of ${loc}, ${a} and ${b} found that even little worries feel smaller when you share them with a friend.`,
      dialogue: [
        { character: a, line: `Look, ${b}! I think someone needs our help.`, emotion: "excited" },
        { character: b, line: `Let's take a deep breath and figure it out together, ${a}.`, emotion: "reassuring" },
        { character: a, line: `You're right. We can do this if we're kind and patient.`, emotion: "hopeful" },
      ],
      mood: MOODS[i % MOODS.length],
      durationSec: 120 + seededInt(seed + i, 0, 50),
    };
  });

  return {
    title: "Pip & Bramble and the Whispering Woods",
    hook: "When a tiny lantern goes missing in the woods, two best friends set out to make things right before nightfall.",
    outline: [
      "Pip notices something is wrong in the meadow",
      "The friends gather clues at the creek",
      "A gentle misunderstanding is uncovered",
      "Teamwork saves the day",
      "A warm lesson is shared",
      "A new mystery flickers on the horizon",
    ],
    theme: "Friendship and patience",
    lesson: "Big problems feel smaller when you face them together.",
    scenes,
    cliffhanger:
      "As the sun set, a glimmering map fluttered down from the old oak — addressed to 'a brave new friend.'",
    nextSetup: "Who sent the map, and where will it lead Pip and Bramble next?",
    canon: [
      { category: "event", summary: "Pip and Bramble recovered the lost lantern of Whispering Woods.", detail: "" },
      { category: "item", summary: "A mysterious glimmering map appeared at the old oak.", detail: "" },
    ],
  };
}

// EpisodeSeo matching src/lib/pipeline/schema.ts (chapters are added by the stage).
function buildSeo(): unknown {
  return {
    title: "Pip & Bramble: The Whispering Woods Adventure 🦊🐻 | Cartoon for Kids",
    description:
      "Join Pip the fox and Bramble the bear on a heartwarming adventure through the Whispering Woods! " +
      "In this episode our friends learn that big problems feel smaller when you face them together. 🌳✨\n\n" +
      "A gentle, wholesome cartoon for ages 3–8 about friendship, kindness, and patience. " +
      "New episodes every day!\n\n" +
      "👍 Like this video and subscribe so you never miss an adventure.",
    tags: [
      "pip and bramble", "kids cartoon", "cartoon for kids", "animated story",
      "bedtime story", "friendship", "adventure", "preschool", "toddler videos",
      "learning for kids", "wholesome cartoon", "fox and bear", "story time",
      "kids animation", "moral stories",
    ],
    keywords: ["kids cartoon", "preschool", "friendship", "bedtime", "animated series", "ages 3-8"],
    hashtags: ["#kidscartoon", "#animation", "#pipandbramble", "#storytime"],
  };
}

function buildJson(systemText: string, userText: string): unknown {
  const p = `${systemText}\n${userText}`.toLowerCase();
  const seed = hashKey(userText);

  // Episode planning (premise) — Premise shape {workingTitle, premise, theme, lesson}.
  if (p.includes("workingtitle") || (p.includes("plan") && p.includes("premise")) || p.includes("showrunner")) {
    return {
      workingTitle: "The Whispering Woods Map",
      premise:
        "After returning the lost lantern, Pip and Bramble discover a glimmering map at the old oak that " +
        "promises a new adventure. They decide to follow it, learning that curiosity is best paired with caution " +
        "and kindness. Along the way they help a worried woodland friend and pick up the next clue.",
      theme: "Curiosity and courage",
      lesson: "It's brave to try new things when you bring kindness along.",
    };
  }

  // Full script.
  if ((p.includes("scene") && p.includes("dialogue")) || p.includes("children's tv writer") || p.includes("full episode")) {
    return buildScript(seed);
  }

  // SEO.
  if (p.includes("seo") || p.includes("hashtag") || (p.includes("tags") && p.includes("description"))) {
    return buildSeo();
  }

  // Thumbnail concept.
  if (p.includes("thumbnail")) {
    return {
      concept: "Pip and Bramble peeking out from glowing woods, wide-eyed with wonder.",
      headline: "WHAT'S IN THE WOODS?",
      palette: ["#2E7D32", "#FFD54F", "#1565C0"],
      emotion: "wonder",
    };
  }

  // Optimization recommendations.
  if (p.includes("recommend") || p.includes("optimi")) {
    return {
      recommendations: [
        { area: "titles", idea: "Lead with a character name + curiosity gap", impact: "high" },
        { area: "thumbnails", idea: "Bigger emotional close-ups, 1-3 words of text", impact: "high" },
        { area: "schedule", idea: "Post the second daily episode at 18:00 local", impact: "medium" },
      ],
    };
  }

  // Generic, still-valid JSON fallback.
  return { summary: "Deterministic mock response.", promptEcho: userText.slice(0, 200), seed };
}

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  async generate(opts: LlmGenerateOptions): Promise<ProviderResult<string>> {
    const userText = lastUserText(opts);
    const systemText = opts.system ?? "";

    let data: string;
    if (opts.json) {
      data = JSON.stringify(buildJson(systemText, userText), null, 2);
    } else {
      const seed = hashKey(userText);
      data =
        `Mock narration (seed ${seed.slice(0, 8)}).\n\n` +
        `In the heart of the Whispering Woods, Pip and Bramble set off on a new adventure. ` +
        `Together they learned that the bravest thing is to keep trying — and to be kind along the way.`;
    }

    return {
      data,
      provider: this.name,
      costMicroUsd: 0,
      meta: { mock: true, json: !!opts.json },
    };
  }
}
