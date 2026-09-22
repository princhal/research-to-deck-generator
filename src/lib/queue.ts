import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { GenerateJobData } from "./types";

export const QUEUE_NAME = "deck-generation";

let connection: IORedis | null = null;
let queue: Queue<GenerateJobData> | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");
    connection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function getQueue(): Queue<GenerateJobData> {
  if (!queue) {
    queue = new Queue<GenerateJobData>(QUEUE_NAME, { connection: getRedisConnection() });
  }
  return queue;
}
