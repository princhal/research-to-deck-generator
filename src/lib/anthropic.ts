import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

/** Extracts the text of the first text block in a Claude response. */
export function textFromMessage(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude response contained no text block");
  }
  return block.text;
}
