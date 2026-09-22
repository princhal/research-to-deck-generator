const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/rerank";
const EMBED_MODEL = "voyage-3";
const RERANK_MODEL = "rerank-2";

function apiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set");
  return key;
}

export async function embedTexts(
  texts: string[],
  inputType: "document" | "query"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model: EMBED_MODEL, input_type: inputType }),
  });
  if (!res.ok) {
    throw new Error(`Voyage embeddings request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

export async function rerank(
  query: string,
  documents: string[],
  topK: number
): Promise<{ index: number; relevanceScore: number }[]> {
  if (documents.length === 0) return [];
  const res = await fetch(VOYAGE_RERANK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, documents, model: RERANK_MODEL, top_k: topK }),
  });
  if (!res.ok) {
    throw new Error(`Voyage rerank request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data: { index: number; relevance_score: number }[];
  };
  return data.data.map((d) => ({ index: d.index, relevanceScore: d.relevance_score }));
}
