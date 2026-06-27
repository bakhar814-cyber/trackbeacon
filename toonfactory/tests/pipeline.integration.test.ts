import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { enqueue, leaseNext, complete, fail } from "@/lib/queue/queue";
import { getOrCreateSeries } from "@/lib/story/manager";
import { startEpisodeProduction } from "@/lib/pipeline/orchestrator";
import { tick } from "@/lib/queue/runner";

// These tests require a real Postgres (migrated schema). They opt in via
// DATABASE_URL and are skipped otherwise so `npm test` stays green locally.
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("job queue", () => {
  beforeAll(async () => {
    // Isolate from any leftover queued jobs so leaseNext returns our own job.
    await prisma.job.deleteMany({});
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("enqueues, leases exactly once, and completes", async () => {
    const job = await enqueue({ stage: "noop-test", payload: { x: 1 } });
    const leased = await leaseNext("w1");
    expect(leased?.id).toBeTruthy();
    // A second worker must not get the same job.
    const second = await leaseNext("w2");
    expect(second?.id).not.toBe(leased?.id);
    await complete(leased!.id, { ok: true });
    const done = await prisma.job.findUnique({ where: { id: job.id } });
    expect(done?.status).toBe("SUCCEEDED");
  });

  it("reschedules with backoff until maxAttempts, then FAILS", async () => {
    const job = await enqueue({ stage: "noop-fail", maxAttempts: 2 });
    const a = await leaseNext("w1");
    await fail(a!, "boom");
    let row = await prisma.job.findUnique({ where: { id: job.id } });
    expect(row?.status).toBe("QUEUED"); // retry scheduled
    // Force it runnable again and exhaust attempts.
    await prisma.job.update({ where: { id: job.id }, data: { runAfter: new Date(0) } });
    const b = await leaseNext("w1");
    await fail(b!, "boom again");
    row = await prisma.job.findUnique({ where: { id: job.id } });
    expect(row?.status).toBe("FAILED");
  });
});

describe.skipIf(!hasDb)("full episode pipeline (mock providers)", () => {
  let episodeId: string;

  beforeAll(async () => {
    const series = await getOrCreateSeries();
    episodeId = await startEpisodeProduction(series.id);
    for (let i = 0; i < 50; i++) {
      const pending = await prisma.job.count({
        where: { episodeId, status: { in: ["QUEUED", "RUNNING"] } },
      });
      if (pending === 0) break;
      const r = await tick("vitest", 3);
      if (r.processed === 0) break;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("drives the episode to SCHEDULED with all stages succeeded", async () => {
    const ep = await prisma.episode.findUniqueOrThrow({
      where: { id: episodeId },
      include: { scenes: true, thumbnails: true, jobs: true },
    });
    const stages = ep.jobs.filter((j) => j.status === "SUCCEEDED").map((j) => j.stage);
    for (const s of ["plan", "script", "images", "voice", "edit", "seo", "qc", "upload"]) {
      expect(stages).toContain(s);
    }
    expect(ep.status).toBe("SCHEDULED");
    expect(ep.youtubeId).toBeTruthy();
    expect(ep.videoUrl).toBeTruthy();
    expect(ep.thumbnailUrl).toBeTruthy();
    expect(ep.scenes.length).toBeGreaterThanOrEqual(6);
    expect(ep.thumbnails.length).toBeGreaterThanOrEqual(1);
    expect(ep.thumbnails.some((t) => t.chosen)).toBe(true);
  });

  it("produces complete SEO with chapters", async () => {
    const ep = await prisma.episode.findUniqueOrThrow({ where: { id: episodeId } });
    const seo = ep.seo as { title?: string; description?: string; tags?: string[]; chapters?: unknown[] };
    expect(seo.title).toBeTruthy();
    expect(seo.description).toBeTruthy();
    expect((seo.tags ?? []).length).toBeGreaterThan(5);
    expect((seo.chapters ?? []).length).toBeGreaterThan(1);
  });
});
