import type { PaperMeta } from "./types";

const SEARCH_URL = "https://api.openalex.org/works";
const SELECT_FIELDS =
  "id,title,authorships,publication_year,primary_location,open_access,best_oa_location,abstract_inverted_index";

interface RawWork {
  id: string;
  title: string | null;
  authorships: { author: { display_name: string } }[];
  publication_year: number | null;
  primary_location: {
    landing_page_url: string | null;
    pdf_url: string | null;
    source: { display_name: string | null } | null;
  } | null;
  open_access: { oa_url: string | null } | null;
  best_oa_location: { pdf_url: string | null } | null;
  abstract_inverted_index: Record<string, number[]> | null;
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | null): string | null {
  if (!invertedIndex) return null;
  const positions: string[] = [];
  for (const [word, indices] of Object.entries(invertedIndex)) {
    for (const i of indices) positions[i] = word;
  }
  const text = positions.join(" ").trim();
  return text.length > 0 ? text : null;
}

/** Searches OpenAlex for a topic. Fully unauthenticated and unlimited for
 * reasonable use; set OPENALEX_MAILTO to join the "polite pool" (higher
 * rate limits, priority support) per OpenAlex's own convention. */
export async function searchPapers(topic: string, limit: number): Promise<PaperMeta[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("search", topic);
  url.searchParams.set("per-page", String(Math.min(limit, 200)));
  url.searchParams.set("select", SELECT_FIELDS);
  const mailto = process.env.OPENALEX_MAILTO;
  if (mailto) url.searchParams.set("mailto", mailto);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OpenAlex search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { results: RawWork[] };

  return data.results
    .filter((w) => w.title)
    .map((w) => ({
      id: w.id,
      title: w.title as string,
      authors: w.authorships.map((a) => a.author.display_name),
      year: w.publication_year,
      venue: w.primary_location?.source?.display_name ?? null,
      url: w.primary_location?.landing_page_url ?? w.id,
      openAccessPdfUrl:
        w.open_access?.oa_url ??
        w.best_oa_location?.pdf_url ??
        w.primary_location?.pdf_url ??
        null,
      abstract: reconstructAbstract(w.abstract_inverted_index),
    }));
}

/** Downloads and extracts text from a paper's open-access PDF, if available.
 * Falls back to the (reconstructed) abstract — OpenAlex does not provide
 * full text for closed-access papers. */
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
