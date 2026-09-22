export interface PaperMeta {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  url: string | null;
  openAccessPdfUrl: string | null;
  abstract: string | null;
}

export interface RetrievedChunk {
  chunkId: number;
  paperId: string;
  title: string;
  authors: string[];
  year: number | null;
  url: string | null;
  content: string;
  relevanceScore: number;
}

export interface SlideBullet {
  text: string;
  sourceChunkIds: number[];
}

export interface SlidePlanSlide {
  title: string;
  bullets: SlideBullet[];
  speakerNotes: string;
}

export interface SlidePlan {
  deckTitle: string;
  subtitle: string;
  slides: SlidePlanSlide[];
}

export type JobStatus =
  | "queued"
  | "ingesting"
  | "retrieving"
  | "synthesizing"
  | "assembling"
  | "complete"
  | "failed";

export interface GenerateJobData {
  jobId: string;
  topic: string;
}
