import { prisma } from "../db";
import type { Job, JobStatus } from "@prisma/client";

// A database-backed job queue with leasing + retries. It is intentionally
// simple and dependency-free so the system runs anywhere; the same interface
// maps cleanly onto Redis/BullMQ for high-throughput production (see SCALING.md).

export interface EnqueueArgs {
  episodeId?: string;
  stage: string;
  payload?: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
  runAfter?: Date;
}

export async function enqueue(args: EnqueueArgs): Promise<Job> {
  return prisma.job.create({
    data: {
      episodeId: args.episodeId,
      stage: args.stage,
      payload: (args.payload ?? {}) as object,
      priority: args.priority ?? 0,
      maxAttempts: args.maxAttempts ?? 3,
      runAfter: args.runAfter ?? new Date(),
    },
  });
}

// Atomically lease the next runnable job for a worker. Uses a conditional
// update so two workers never grab the same job (optimistic lock on status).
export async function leaseNext(workerId: string): Promise<Job | null> {
  const candidate = await prisma.job.findFirst({
    where: { status: "QUEUED", runAfter: { lte: new Date() } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  if (!candidate) return null;

  const claimed = await prisma.job.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      lockedBy: workerId,
      lockedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
  if (claimed.count === 0) return leaseNext(workerId); // lost the race; retry
  return prisma.job.findUnique({ where: { id: candidate.id } });
}

export async function complete(
  jobId: string,
  result: Record<string, unknown> = {},
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "SUCCEEDED", result: result as object, error: null, lockedBy: null },
  });
}

// On failure, either reschedule with exponential backoff or mark FAILED.
export async function fail(job: Job, error: string): Promise<void> {
  if (job.attempts < job.maxAttempts) {
    const backoffMs = Math.min(60_000, 2_000 * 2 ** (job.attempts - 1));
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        error,
        lockedBy: null,
        lockedAt: null,
        runAfter: new Date(Date.now() + backoffMs),
      },
    });
  } else {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "FAILED", error, lockedBy: null },
    });
  }
}

export async function setStatus(jobId: string, status: JobStatus): Promise<void> {
  await prisma.job.update({ where: { id: jobId }, data: { status } });
}

// Recover jobs whose worker died mid-run (lease older than `staleMs`).
export async function requeueStale(staleMs = 10 * 60_000): Promise<number> {
  const cutoff = new Date(Date.now() - staleMs);
  const res = await prisma.job.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: cutoff } },
    data: { status: "QUEUED", lockedBy: null, lockedAt: null },
  });
  return res.count;
}
