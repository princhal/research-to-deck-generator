import { Worker } from "bullmq";
import { QUEUE_NAME, getRedisConnection } from "../lib/queue";
import { processGenerate } from "./processGenerate";

const worker = new Worker(QUEUE_NAME, processGenerate, {
  connection: getRedisConnection(),
  concurrency: 2,
});

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} complete`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

console.log(`[worker] listening on queue "${QUEUE_NAME}"`);

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
