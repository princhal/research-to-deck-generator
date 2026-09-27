import { execFile } from "node:child_process";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { RetrievedChunk, SlidePlan } from "./types";
import { uploadDeck } from "./storage";

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const GENERATE_SCRIPT = path.join(PROJECT_ROOT, "scripts", "generate_deck.py");
const BRAND_CONFIG = path.join(PROJECT_ROOT, "branding", "brand.json");

/** Renders the slide plan to a .pptx file by shelling out to the Python
 * generate_deck.py script (python-pptx has no Node equivalent), then
 * uploads it to R2 and returns the object key. The worker and the API
 * don't share a filesystem, so the rendered file itself is discarded once
 * it's in object storage. */
export async function assembleDeck(
  jobId: string,
  plan: SlidePlan,
  findings: RetrievedChunk[]
): Promise<string> {
  const brand = JSON.parse(await readFile(BRAND_CONFIG, "utf8"));

  const citations = Object.fromEntries(
    findings.map((f) => [
      f.chunkId,
      { paperId: f.paperId, title: f.title, authors: f.authors, year: f.year, url: f.url },
    ])
  );

  const payload = { brand, ...plan, citations };

  const tmpDir = await mkdtemp(path.join(tmpdir(), "deck-input-"));
  const inputPath = path.join(tmpDir, "input.json");
  await writeFile(inputPath, JSON.stringify(payload));

  const outputDir = process.env.DECK_OUTPUT_DIR || path.join(PROJECT_ROOT, "generated");
  const outputPath = path.join(outputDir, `${jobId}.pptx`);

  try {
    await execFileAsync("python3", [GENERATE_SCRIPT, inputPath, outputPath]);
    return await uploadDeck(jobId, outputPath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
    await rm(outputPath, { force: true });
  }
}
