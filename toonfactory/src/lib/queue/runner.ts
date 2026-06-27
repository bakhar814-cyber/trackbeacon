import { leaseNext, complete, fail, requeueStale } from "./queue";
import { runStage } from "../pipeline/orchestrator";
import { log } from "../logger";

// Process up to `max` queued jobs. Used by both the long-running worker and the
// /api/jobs/tick endpoint (which lets the dashboard advance the pipeline a step
// at a time, and lets serverless cron drive production without a daemon).
export async function tick(workerId: string, max = 5): Promise<{ processed: number }> {
  await requeueStale();
  let processed = 0;
  for (let i = 0; i < max; i++) {
    const job = await leaseNext(workerId);
    if (!job) break;
    try {
      const { result } = await runStage(job.stage, {
        episodeId: job.episodeId ?? "",
        payload: (job.payload as Record<string, unknown>) ?? {},
      });
      await complete(job.id, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await fail(job, msg);
      await log.error(`job ${job.stage} failed: ${msg}`, {
        scope: "worker",
        jobId: job.id,
        episodeId: job.episodeId ?? undefined,
      });
    }
    processed++;
  }
  return { processed };
}
