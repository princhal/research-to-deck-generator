import type { PaperMeta } from "./types";

const SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search";
const FIELDS = "title,authors,year,venue,url,abstract,openAccessPdf";

interface RawPaper {
  paperId: string;
  title: string;
  authors: { name: string }[];
  year: number | null;
  venue: string | null;
  url: string | null;
  abstract: string | null;
  openAccessPdf: { url: string } | null;
}

/** Searches Semantic Scholar for a topic. Works unauthenticated (rate-limited);
 * set SEMANTIC_SCHOLAR_API_KEY for higher limits. */
export async function searchPapers(topic: string, limit: number): Promise<PaperMeta[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("query", topic);
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("limit", String(Math.min(limit, 100)));

  const headers: Record<string, string> = {};
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Semantic Scholar search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { data: RawPaper[] };

  return data.data.map((p) => ({
    id: p.paperId,
    title: p.title,
    authors: (p.authors ?? []).map((a) => a.name),
    year: p.year,
    venue: p.venue,
    url: p.url,
    openAccessPdfUrl: p.openAccessPdf?.url ?? null,
    abstract: p.abstract,
  }));
}

/** Downloads and extracts text from a paper's open-access PDF, if available.
 * Falls back to the abstract when no open-access PDF exists — Semantic
 * Scholar does not provide full text for closed-access papers. */
export async function fetchPaperText(paper: PaperMeta): Promise<string | null> {
  if (paper.openAccessPdfUrl) {
    try {
      const res = await fetch(paper.openAccessPdfUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(buffer);
        if (parsed.text.trim().length > 200) return parsed.text;
      }
    } catch {
      // fall through to abstract
    }
  }
  return paper.abstract;
}
