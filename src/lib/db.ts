import { Pool } from "pg";
import type { JobStatus, PaperMeta, RetrievedChunk } from "./types";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString });
  }
  return pool;
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function upsertPaper(paper: PaperMeta): Promise<void> {
  await getPool().query(
    `INSERT INTO papers (id, title, authors, year, venue, url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    [paper.id, paper.title, paper.authors, paper.year, paper.venue, paper.url]
  );
}

export async function insertChunks(
  paperId: string,
  chunks: { index: number; content: string; embedding: number[] }[]
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const chunk of chunks) {
      await client.query(
        `INSERT INTO chunks (paper_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (paper_id, chunk_index) DO NOTHING`,
        [paperId, chunk.index, chunk.content, toVectorLiteral(chunk.embedding)]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Cosine-similarity nearest-neighbor search, scoped to chunks belonging to `paperIds`. */
export async function searchChunks(
  queryEmbedding: number[],
  paperIds: string[],
  limit: number
): Promise<RetrievedChunk[]> {
  if (paperIds.length === 0) return [];
  const { rows } = await getPool().query(
    `SELECT c.id AS chunk_id, c.paper_id, c.content,
            p.title, p.authors, p.year, p.url,
            1 - (c.embedding <=> $1) AS relevance_score
     FROM chunks c
     JOIN papers p ON p.id = c.paper_id
     WHERE c.paper_id = ANY($2)
     ORDER BY c.embedding <=> $1
     LIMIT $3`,
    [toVectorLiteral(queryEmbedding), paperIds, limit]
  );
  return rows.map((r) => ({
    chunkId: r.chunk_id,
    paperId: r.paper_id,
    title: r.title,
    authors: r.authors,
    year: r.year,
    url: r.url,
    content: r.content,
    relevanceScore: Number(r.relevance_score),
  }));
}

export async function createJob(jobId: string, topic: string): Promise<void> {
  await getPool().query(
    `INSERT INTO jobs (id, topic, status) VALUES ($1, $2, 'queued')`,
    [jobId, topic]
  );
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  fields: { error?: string; deckData?: Buffer; paperCount?: number } = {}
): Promise<void> {
  await getPool().query(
    `UPDATE jobs
     SET status = $2, error = $3, deck_data = COALESCE($4, deck_data),
         paper_count = COALESCE($5, paper_count), updated_at = now()
     WHERE id = $1`,
    [jobId, status, fields.error ?? null, fields.deckData ?? null, fields.paperCount ?? null]
  );
}

export async function getJob(jobId: string) {
  const { rows } = await getPool().query(
    `SELECT id, topic, status, error, (deck_data IS NOT NULL) AS has_deck,
            paper_count, created_at, updated_at
     FROM jobs WHERE id = $1`,
    [jobId]
  );
  return rows[0] ?? null;
}

/** Fetched separately from getJob so routine status polls never pull the
 * deck bytes over the wire. */
export async function getDeckData(jobId: string): Promise<Buffer | null> {
  const { rows } = await getPool().query(`SELECT deck_data FROM jobs WHERE id = $1`, [jobId]);
  return rows[0]?.deck_data ?? null;
}
