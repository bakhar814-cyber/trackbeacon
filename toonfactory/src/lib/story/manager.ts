import { prisma } from "../db";
import { config } from "../config";

// The Story Manager is the long-term memory of the series. It assembles the
// "continuity context" handed to the LLM before every script so episodes stay
// consistent forever (characters, world rules, relationships, prior events) and
// records new canon afterward so nothing is forgotten.

export async function getOrCreateSeries() {
  let series = await prisma.series.findFirst({ orderBy: { createdAt: "asc" } });
  if (!series) {
    series = await prisma.series.create({
      data: {
        title: config.series.title,
        logline:
          "Two best friends explore a cozy enchanted forest, solving gentle problems and learning a kind lesson in every episode.",
        targetAge: "3-8",
        worldRules: {
          tone: "gentle, wholesome, reassuring",
          mustHave: ["a clear kind lesson", "no real peril", "a hopeful ending"],
          mustAvoid: ["violence", "scary imagery", "mean-spirited humor", "brand names"],
        },
        artStyle: {
          medium: "soft 2D storybook illustration",
          palette: "warm pastels",
          linework: "thick friendly outlines",
          lighting: "soft golden-hour",
        },
      },
    });
  }
  return series;
}

export interface ContinuityContext {
  seriesId: string;
  title: string;
  logline: string;
  worldRules: unknown;
  artStyle: unknown;
  characters: Array<{
    id: string;
    name: string;
    role: string;
    age: string;
    personality: unknown;
    designToken: string;
  }>;
  locations: Array<{ id: string; name: string; description: string }>;
  relationships: Array<{ a: string; b: string; kind: string; status: string }>;
  recentCanon: Array<{ category: string; summary: string }>;
  lastEpisode: {
    number: number;
    title: string;
    cliffhanger: string;
    nextSetup: string;
  } | null;
  nextNumber: number;
}

// Build everything the writer needs to continue the story like a real TV series.
export async function buildContinuityContext(seriesId: string): Promise<ContinuityContext> {
  const [series, characters, locations, relationships, canon, lastEpisode, maxAgg] =
    await Promise.all([
      prisma.series.findUniqueOrThrow({ where: { id: seriesId } }),
      prisma.character.findMany({ where: { seriesId } }),
      prisma.location.findMany({ where: { seriesId } }),
      prisma.relationship.findMany({
        where: { seriesId },
        include: { a: true, b: true },
      }),
      prisma.canonFact.findMany({
        where: { seriesId },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.episode.findFirst({
        where: { seriesId, status: "PUBLISHED" },
        orderBy: { number: "desc" },
      }),
      prisma.episode.aggregate({ where: { seriesId }, _max: { number: true } }),
    ]);

  return {
    seriesId,
    title: series.title,
    logline: series.logline,
    worldRules: series.worldRules,
    artStyle: series.artStyle,
    characters: characters.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      age: c.age,
      personality: c.personality,
      designToken: c.designToken,
    })),
    locations: locations.map((l) => ({ id: l.id, name: l.name, description: l.description })),
    relationships: relationships.map((r) => ({
      a: r.a.name,
      b: r.b.name,
      kind: r.kind,
      status: r.status,
    })),
    recentCanon: canon
      .reverse()
      .map((f) => ({ category: f.category, summary: f.summary })),
    lastEpisode: lastEpisode
      ? {
          number: lastEpisode.number,
          title: lastEpisode.title,
          cliffhanger: lastEpisode.cliffhanger,
          nextSetup: lastEpisode.nextSetup,
        }
      : null,
    nextNumber: (maxAgg._max.number ?? 0) + 1,
  };
}

// Persist new canon facts produced by an episode so future episodes remember.
export async function recordCanon(
  seriesId: string,
  episodeId: string,
  facts: Array<{ category: string; summary: string; detail?: string }>,
): Promise<void> {
  if (!facts.length) return;
  await prisma.canonFact.createMany({
    data: facts.map((f) => ({
      seriesId,
      episodeId,
      category: f.category,
      summary: f.summary,
      detail: f.detail ?? "",
    })),
  });
}

// Render the continuity context into a compact prompt block for the LLM.
export function continuityToPrompt(ctx: ContinuityContext): string {
  const chars = ctx.characters
    .map((c) => `- ${c.name} (${c.role}, age ${c.age}): ${c.designToken}`)
    .join("\n");
  const locs = ctx.locations.map((l) => `- ${l.name}: ${l.description}`).join("\n");
  const rels = ctx.relationships
    .map((r) => `- ${r.a} & ${r.b}: ${r.kind} (${r.status})`)
    .join("\n");
  const canon = ctx.recentCanon.map((f) => `- [${f.category}] ${f.summary}`).join("\n");
  const last = ctx.lastEpisode
    ? `Previous episode #${ctx.lastEpisode.number} "${ctx.lastEpisode.title}" ended on this cliffhanger: ${ctx.lastEpisode.cliffhanger}\nIt set up: ${ctx.lastEpisode.nextSetup}`
    : "This is the very first episode.";

  return [
    `SERIES: ${ctx.title}`,
    `LOGLINE: ${ctx.logline}`,
    `WORLD RULES: ${JSON.stringify(ctx.worldRules)}`,
    `ART STYLE: ${JSON.stringify(ctx.artStyle)}`,
    `\nCHARACTERS:\n${chars}`,
    `\nLOCATIONS:\n${locs}`,
    `\nRELATIONSHIPS:\n${rels}`,
    `\nSTORY SO FAR (most recent canon):\n${canon}`,
    `\nCONTINUITY:\n${last}`,
    `\nThis must be episode #${ctx.nextNumber}. Continue the story; do not contradict any canon above.`,
  ].join("\n");
}
