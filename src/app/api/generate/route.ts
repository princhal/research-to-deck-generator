import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createJob } from "@/lib/db";
import { getQueue } from "@/lib/queue";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const topic = (body as { topic?: unknown })?.topic;
  if (typeof topic !== "string" || topic.trim().length === 0) {
    return NextResponse.json({ error: "`topic` is required and must be a non-empty string" }, { status: 400 });
  }

  const jobId = randomUUID();
  await createJob(jobId, topic.trim());
  await getQueue().add("generate", { jobId, topic: topic.trim() }, { jobId });

  return NextResponse.json({ jobId, statusUrl: `/api/status/${jobId}` }, { status: 202 });
}
