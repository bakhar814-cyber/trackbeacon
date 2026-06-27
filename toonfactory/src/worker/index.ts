import { tick } from "../lib/queue/runner";
import { runDailyProduction } from "../lib/production/daily";
import { log } from "../lib/logger";

// Long-running worker process. Runs alongside the web app (see docker-compose).
// Polls the database queue and executes pipeline stages. Scale horizontally by
// running multiple instances — leasing prevents double-processing.

const WORKER_ID = `worker-${process.pid}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3000);

// Internal daily-production scheduler. Enabled by default so a single running
// worker fully automates the channel with no external cron. Set
// WORKER_AUTOPRODUCE=false to drive production exclusively via /api/cron/produce.
const AUTOPRODUCE = (process.env.WORKER_AUTOPRODUCE ?? "true") !== "false";
const AUTOPRODUCE_INTERVAL_MS = Number(process.env.WORKER_AUTOPRODUCE_INTERVAL_MS ?? 3_600_000);
let lastDaily = 0;

async function maybeProduceDaily() {
  if (!AUTOPRODUCE) return;
  if (Date.now() - lastDaily < AUTOPRODUCE_INTERVAL_MS) return;
  lastDaily = Date.now();
  try {
    const r = await runDailyProduction();
    if (r.started.length) {
      await log.info(`autoproduce: queued ${r.started.length} episode(s)`, { scope: "worker" });
    }
  } catch (err) {
    await log.error(`autoproduce failed: ${String(err)}`, { scope: "worker" });
  }
}

let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

async function main() {
  await log.info(`${WORKER_ID} online`, { scope: "worker" });
  while (!stopping) {
    try {
      await maybeProduceDaily();
      const { processed } = await tick(WORKER_ID, 3);
      if (processed === 0) await sleep(POLL_MS);
    } catch (err) {
      await log.error(`worker loop error: ${String(err)}`, { scope: "worker" });
      await sleep(POLL_MS);
    }
  }
  await log.info(`${WORKER_ID} shutting down`, { scope: "worker" });
  process.exit(0);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main();
