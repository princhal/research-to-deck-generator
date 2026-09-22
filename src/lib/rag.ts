import { getAnthropic, getModel, textFromMessage } from "./anthropic";
import { embedTexts, rerank } from "./embeddings";
import { searchChunks } from "./db";
import type { RetrievedChunk } from "./types";

const QUERIES_PER_TOPIC = 4;
const CANDIDATES_PER_QUERY = 15;
const FINAL_TOP_K = 20;

/** Asks Claude for alternative phrasings of the topic to widen recall
 * before the vector search (multi-query RAG). */
async function expandQuery(topic: string): Promise<string[]> {
  const message = await getAnthropic().messages.create({
    model: getModel(),
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Generate ${QUERIES_PER_TOPIC} distinct search-engine-style queries that would surface academic papers relevant to this research topic, covering different angles (methods, applications, related terminology). Return ONLY a JSON array of strings, no other text.\n\nTopic: ${topic}`,
      },
    ],
  });
  const text = textFromMessage(message);
  try {
    const queries = JSON.parse(text) as string[];
    return [topic, ...queries.filter((q) => typeof q === "string" && q.trim())];
  } catch {
    return [topic];
  }
}

/** Multi-query retrieval with rerank: expands the topic into several
 * queries, does a vector search per query, merges + dedupes candidates,
 * then reranks against the original topic for a final relevance-sorted list. */
export async function retrieveFindings(
  topic: string,
  paperIds: string[]
): Promise<RetrievedChunk[]> {
  const queries = await expandQuery(topic);
  const queryEmbeddings = await embedTexts(queries, "query");

  const candidatesByChunkId = new Map<number, RetrievedChunk>();
  for (const embedding of queryEmbeddings) {
    const results = await searchChunks(embedding, paperIds, CANDIDATES_PER_QUERY);
    for (const chunk of results) {
      const existing = candidatesByChunkId.get(chunk.chunkId);
      if (!existing || chunk.relevanceScore > existing.relevanceScore) {
        candidatesByChunkId.set(chunk.chunkId, chunk);
      }
    }
  }

  const candidates = [...candidatesByChunkId.values()];
  if (candidates.length === 0) return [];

  const reranked = await rerank(
    topic,
    candidates.map((c) => c.content),
    Math.min(FINAL_TOP_K, candidates.length)
  );

  return reranked.map((r) => ({ ...candidates[r.index], relevanceScore: r.relevanceScore }));
}
