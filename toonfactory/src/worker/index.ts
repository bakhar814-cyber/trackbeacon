import { tick } from "../lib/queue/runner";
import { log } from "../lib/logger";

// Long-running worker process. Runs alongside the web app (see docker-compose).
// Polls the database queue and executes pipeline stages. Scale horizontally by
// running multiple instances — leasing prevents double-processing.

const WORKER_ID = `worker-${process.pid}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3000);

let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

async function main() {
  await log.info(`${WORKER_ID} online`, { scope: "worker" });
  while (!stopping) {
    try {
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
