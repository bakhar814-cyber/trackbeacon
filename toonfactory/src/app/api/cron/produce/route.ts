import { json, errorJson, requireCronSecret } from "@/lib/api";
import { runDailyProduction } from "@/lib/production/daily";
import { tick } from "@/lib/queue/runner";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/cron/produce — the daily heartbeat for serverless/Actions schedulers.
// Queues the day's episodes, refreshes analytics + recommendations, and advances
// the queue a few batches (the always-on worker finishes the rest). Secured by
// the x-cron-secret header (or Authorization: Bearer / ?secret=).
//
// NOTE: a single-box deploy with the worker running does NOT need this endpoint —
// the worker runs the same daily production internally. This exists for
// serverless hosts (Vercel Cron, GitHub Actions) where there is no daemon.
export async function POST(req: Request) {
  const unauth = requireCronSecret(req);
  if (unauth) return unauth;

  try {
    const result = await runDailyProduction();

    let processed = 0;
    for (let i = 0; i < 8; i++) {
      const r = await tick(`cron-${Date.now()}`, 5);
      processed += r.processed;
      if (r.processed === 0) break;
    }

    await log.info(`cron: started ${result.started.length}, processed ${processed} jobs`, {
      scope: "cron",
    });
    return json({ ...result, processed });
  } catch (err) {
    return errorJson(`cron failed: ${String(err)}`, 500);
  }
}

// Allow a manual GET trigger with ?secret= for convenience.
export async function GET(req: Request) {
  return POST(req);
}
