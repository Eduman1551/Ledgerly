// The trust strip: one honest line about what (if anything) was sent to AI.
import type { AiPath } from "@/lib/db/schema";

export type TrustInfo = { aiPath: AiPath; model: string | null; charsSentToAi: number; redactionsCount: number };

export function trustStripText(run: TrustInfo): string {
  const model = run.model ?? "AI";
  switch (run.aiPath) {
    case "local_only":
      return "Checked locally · 0 data sent to AI";
    case "redacted_ai":
      return `Redacted text (${run.redactionsCount} item${run.redactionsCount === 1 ? "" : "s"} hidden) sent to ${model} · ${run.charsSentToAi} chars`;
    case "full_ai":
      return run.redactionsCount > 0
        ? `Public text sent to ${model} · ${run.charsSentToAi} chars · ${run.redactionsCount} confidential value${run.redactionsCount === 1 ? "" : "s"} hidden`
        : `Public text sent to ${model} · ${run.charsSentToAi} chars`;
    case "ai_failed_fallback":
      return run.charsSentToAi > 0
        ? `AI unavailable, checked with local rules · ${run.charsSentToAi} chars were sent before the failure`
        : "AI unavailable, checked with local rules";
  }
}
