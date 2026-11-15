// Server-only AI client (Gemini through the Vercel AI SDK). The API key is read
// from the environment here and never reaches the browser.
// Note: AI SDK v7 replaced `generateObject` with `generateText` + `Output.object`;
// the result is still validated against a Zod schema.
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type { z } from "zod";

export const AI_TIMEOUT_MS = 15_000;
export const DEFAULT_MODEL = "gemini-3.8-flash";

export const aiModelId = () => process.env.LLM_MODEL?.trim() || DEFAULT_MODEL;
export const isAiConfigured = () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());

/** Human-readable model name for the trust strip, e.g. "Gemini 3.8 Flash". */
export function aiModelLabel(): string {
  return aiModelId()
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

/** One structured AI call: Zod-validated output, 15 s timeout, no retries (the caller has a local fallback). */
export async function generateStructured<T>(options: { schema: z.ZodType<T>; system: string; prompt: string }): Promise<T> {
  if (!isAiConfigured()) throw new Error("AI is not configured");
  const result = await generateText({
    model: google(aiModelId()),
    output: Output.object({ schema: options.schema }),
    system: options.system,
    prompt: options.prompt,
    temperature: 0,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  return options.schema.parse(result.output);
}
