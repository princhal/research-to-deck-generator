const CHUNK_SIZE = 1000;
const OVERLAP = 150;

/** Splits text into overlapping character-window chunks, breaking on
 * paragraph/sentence boundaries where possible. Good enough for research
 * prose; swap for a token-aware splitter if precision on token limits matters. */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);
    if (end < normalized.length) {
      const lastBoundary = normalized.lastIndexOf(". ", end);
      if (lastBoundary > start + CHUNK_SIZE / 2) end = lastBoundary + 1;
    }
    chunks.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = end - OVERLAP;
  }
  return chunks.filter((c) => c.length > 0);
}
