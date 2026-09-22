import { getAnthropic, getModel, textFromMessage } from "./anthropic";
import type { RetrievedChunk, SlidePlan } from "./types";

const SYSTEM_PROMPT = `You are a research analyst who turns retrieved academic findings into a tight, presentation-ready slide plan. You only state claims that are supported by the provided findings — you never invent statistics, quotes, or citations. Every bullet must cite the chunk id(s) it is drawn from.`;

function buildFindingsBlock(findings: RetrievedChunk[]): string {
  return findings
    .map(
      (f) =>
        `<finding chunk_id="${f.chunkId}" paper="${f.title}" authors="${f.authors.join(", ")}" year="${f.year ?? "n.d."}">\n${f.content}\n</finding>`
    )
    .join("\n\n");
}

/** Calls Claude to synthesize a slide plan (titles, bullets with citations,
 * speaker notes) from reranked findings. Requests strict JSON output and
 * validates it before returning — never guesses at malformed output. */
export async function synthesizeSlidePlan(
  topic: string,
  findings: RetrievedChunk[]
): Promise<SlidePlan> {
  const message = await getAnthropic().messages.create({
    model: getModel(),
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `<topic>${topic}</topic>

<findings>
${buildFindingsBlock(findings)}
</findings>

Produce a slide plan for a research deck on this topic, grounded only in the findings above. Aim for 6-10 content slides.

Return ONLY valid JSON matching this exact shape, no other text:
{
  "deckTitle": string,
  "subtitle": string,
  "slides": [
    {
      "title": string,
      "bullets": [ { "text": string, "sourceChunkIds": number[] } ],
      "speakerNotes": string
    }
  ]
}

Rules:
- Every bullet's sourceChunkIds must reference chunk_id values from <findings>.
- Do not fabricate findings not present in the provided context.
- If evidence is thin for a claim, state the limitation in speakerNotes rather than overstating it.`,
      },
    ],
  });

  const text = textFromMessage(message);
  let plan: SlidePlan;
  try {
    plan = JSON.parse(text) as SlidePlan;
  } catch (err) {
    throw new Error(`Claude did not return valid JSON for the slide plan: ${err}`);
  }
  if (!plan.deckTitle || !Array.isArray(plan.slides) || plan.slides.length === 0) {
    throw new Error("Slide plan is missing required fields");
  }
  return plan;
}
