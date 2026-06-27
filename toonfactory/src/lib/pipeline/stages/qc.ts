import { prisma } from "../../db";
import { log } from "../../logger";
import type { StageContext } from "../orchestrator";

// Words that would violate kid-safe / YouTube Made-for-Kids policy. Kept simple
// and conservative; extend as needed. A real deployment can add a model-based
// safety classifier here.
const BANNED = [
  "kill", "blood", "gun", "weapon", "die", "death", "hate", "stupid",
  "scary", "horror", "drug", "damn",
];

// QUALITY CHECK — verify the episode is complete and policy-compliant before it
// can be uploaded. Returns warnings; throws only on hard failures.
export async function runQc(ctx: StageContext): Promise<Record<string, unknown>> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: ctx.episodeId },
    include: { scenes: true, thumbnails: true },
  });

  const issues: string[] = [];
  const warnings: string[] = [];

  if (!episode.videoUrl) issues.push("missing final video");
  if (!episode.thumbnailUrl) issues.push("missing thumbnail");
  const seo = episode.seo as { title?: string; description?: string };
  if (!seo?.title || !seo?.description) issues.push("incomplete SEO");
  if (episode.scenes.length === 0) issues.push("no scenes");

  for (const s of episode.scenes) {
    if (!s.imageUrl) warnings.push(`scene ${s.index} missing image`);
    const text = `${s.narration} ${JSON.stringify(s.dialogue)}`.toLowerCase();
    const hit = BANNED.find((w) => text.includes(w));
    if (hit) issues.push(`scene ${s.index} contains disallowed word "${hit}"`);
  }

  const totalSec = episode.scenes.reduce((a, s) => a + (s.durationSec || 0), 0);
  if (totalSec < 60) warnings.push(`runtime only ${totalSec}s — shorter than target`);

  if (issues.length) {
    await prisma.episode.update({
      where: { id: ctx.episodeId },
      data: { status: "FAILED" },
    });
    await log.error(`QC failed: ${issues.join("; ")}`, {
      scope: "pipeline",
      episodeId: ctx.episodeId,
    });
    throw new Error(`QC failed: ${issues.join("; ")}`);
  }

  await prisma.episode.update({ where: { id: ctx.episodeId }, data: { status: "READY" } });
  if (warnings.length) {
    await log.warn(`QC warnings: ${warnings.join("; ")}`, {
      scope: "pipeline",
      episodeId: ctx.episodeId,
    });
  }

  return { passed: true, warnings: warnings.length, runtimeSec: totalSec };
}
