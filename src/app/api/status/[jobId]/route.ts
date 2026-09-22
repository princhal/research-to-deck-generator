import { NextResponse } from "next/server";
import { getJob } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    topic: job.topic,
    status: job.status,
    paperCount: job.paper_count,
    error: job.error,
    downloadUrl: job.status === "complete" ? `/api/download/${job.id}` : null,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  });
}
