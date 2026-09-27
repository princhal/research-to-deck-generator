import { NextResponse } from "next/server";
import { getJob } from "@/lib/db";
import { getDeckDownloadUrl } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job || job.status !== "complete" || !job.deck_path) {
    return NextResponse.json({ error: "Deck not ready or job not found" }, { status: 404 });
  }

  const url = await getDeckDownloadUrl(job.deck_path);
  return NextResponse.redirect(url);
}
