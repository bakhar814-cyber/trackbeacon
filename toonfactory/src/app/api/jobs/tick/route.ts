import { json, errorJson } from "@/lib/api";
import { tick } from "@/lib/queue/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/jobs/tick — process a batch of queued jobs. Lets the dashboard and
// serverless cron drive the pipeline without a long-running worker.
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const max = Number(url.searchParams.get("max") ?? 5);
    const res = await tick(`api-${Date.now()}`, Math.min(20, Math.max(1, max)));
    return json(res);
  } catch (err) {
    return errorJson(`tick failed: ${String(err)}`, 500);
  }
}
