import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getJob } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job || job.status !== "complete" || !job.deck_path) {
    return NextResponse.json({ error: "Deck not ready or job not found" }, { status: 404 });
  }

  // NOTE: local-disk read. This works only when the API and worker share a
  // filesystem (e.g. single host, or local dev). On Vercel, this route must
  // instead fetch from object storage — see README "Deployment".
  const buffer = await readFile(job.deck_path);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${job.topic.replace(/[^a-z0-9]+/gi, "-")}.pptx"`,
    },
  });
}
