// POST /api/insights/:id/rewrite → ask AI to polish the proposed wording.
// Only for non-confidential rules; the local template stays if AI is off or fails.
import { eq } from "drizzle-orm";
import { route, requireRole, type IdParams } from "@/lib/api";
import { aiModelLabel, isAiConfigured } from "@/lib/ai/client";
import { polishRewrite } from "@/lib/ai/governance";
import { allowAiCall, clientKey } from "@/lib/ai/rate-limit";
import { getDb } from "@/lib/db";
import { ruleVersions, rules } from "@/lib/db/schema";
import { badRequest } from "@/lib/services/errors";
import { getPendingSuggestion, updateSuggestionBody, type SuggestionEvidence } from "@/lib/services/insights";

export const maxDuration = 30;

export const POST = route(async (request, { params }: IdParams) => {
  await requireRole("admin");
  const { id } = await params;
  const db = await getDb();
  const suggestion = await getPendingSuggestion(db, id);
  const evidence = suggestion.evidence as SuggestionEvidence;
  const [rule] = await db.select().from(rules).where(eq(rules.id, suggestion.ruleId));
  const [version] = await db.select().from(ruleVersions).where(eq(ruleVersions.id, evidence.ruleVersionId));

  if (rule?.tier === "confidential") throw badRequest("This rule is confidential, so it is never sent to AI. The local rewrite stays.");
  if (!isAiConfigured()) throw badRequest("AI is off (no API key). The local rewrite stays.");
  if (!allowAiCall(clientKey(request))) throw badRequest("AI rate limit reached. Try again in a minute.");

  let body: string;
  try {
    body = await polishRewrite({ title: rule?.title ?? "Rule", currentBody: version?.body ?? "", draftRewrite: suggestion.proposedBody, reasons: evidence.reasons });
  } catch {
    throw badRequest("AI is unavailable right now. The local rewrite stays.");
  }
  await updateSuggestionBody(db, id, body, aiModelLabel());
  return { proposedBody: body };
});
