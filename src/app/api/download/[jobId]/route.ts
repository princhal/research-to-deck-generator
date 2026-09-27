import { NextResponse } from "next/server";
import { getDeckData, getJob } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job || job.status !== "complete" || !job.has_deck) {
    return NextResponse.json({ error: "Deck not ready or job not found" }, { status: 404 });
  }

  const buffer = await getDeckData(jobId);
  if (!buffer) {
    return NextResponse.json({ error: "Deck not ready or job not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${job.topic.replace(/[^a-z0-9]+/gi, "-")}.pptx"`,
    },
  });
}
