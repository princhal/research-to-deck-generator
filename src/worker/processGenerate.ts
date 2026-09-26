import type { Job } from "bullmq";
import { searchPapers, fetchPaperText } from "../lib/openAlex";
import { chunkText } from "../lib/chunk";
import { embedTexts } from "../lib/embeddings";
import { upsertPaper, insertChunks, updateJobStatus } from "../lib/db";
import { retrieveFindings } from "../lib/rag";
import { synthesizeSlidePlan } from "../lib/synthesize";
import { assembleDeck } from "../lib/deck";
import type { GenerateJobData } from "../lib/types";

const PAPERS_PER_TOPIC = 50;

export async function processGenerate(job: Job<GenerateJobData>): Promise<void> {
  const { jobId, topic } = job.data;

  try {
    // 1. Ingestion: search, fetch text, chunk, embed, store.
    await updateJobStatus(jobId, "ingesting");
    const papers = await searchPapers(topic, PAPERS_PER_TOPIC);
    if (papers.length === 0) {
      throw new Error(`No papers found on OpenAlex for topic: "${topic}"`);
    }

    const ingestedPaperIds: string[] = [];
    for (const paper of papers) {
      const text = await fetchPaperText(paper);
      if (!text) continue;

      const pieces = chunkText(text);
      if (pieces.length === 0) continue;

      await upsertPaper(paper);
      const embeddings = await embedTexts(pieces, "document");
      await insertChunks(
        paper.id,
        pieces.map((content, i) => ({ index: i, content, embedding: embeddings[i] }))
      );
      ingestedPaperIds.push(paper.id);
    }

    if (ingestedPaperIds.length === 0) {
      throw new Error("No paper text could be retrieved or chunked for this topic");
    }

    // 2. Retrieval: multi-query RAG + rerank.
    await updateJobStatus(jobId, "retrieving", { paperCount: ingestedPaperIds.length });
    const findings = await retrieveFindings(topic, ingestedPaperIds);
    if (findings.length === 0) {
      throw new Error("Retrieval returned no relevant findings");
    }

    // 3. Synthesis: Claude turns findings into a slide plan.
    await updateJobStatus(jobId, "synthesizing");
    const plan = await synthesizeSlidePlan(topic, findings);

    // 4. Assembly: python-pptx builds the branded deck.
    await updateJobStatus(jobId, "assembling");
    const deckPath = await assembleDeck(jobId, plan, findings);

    await updateJobStatus(jobId, "complete", { deckPath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateJobStatus(jobId, "failed", { error: message });
    throw err;
  }
}
