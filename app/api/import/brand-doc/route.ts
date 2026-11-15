// POST /api/import/brand-doc → propose rules and facts from a guideline doc.
// Nothing is saved: the admin picks what to add. Confidential docs never go to AI.
import { route, parseBody, requireRole } from "@/lib/api";
import { aiModelLabel, isAiConfigured } from "@/lib/ai/client";
import { extractFromBrandDoc } from "@/lib/ai/governance";
import { allowAiCall, clientKey } from "@/lib/ai/rate-limit";
import { importDocSchema } from "@/lib/schemas";
import { configForProposal, parseBrandDocLocally } from "@/lib/services/brand-doc";

export const maxDuration = 30;

export const POST = route(async (request) => {
  const body = await parseBody(request, importDocSchema);
  await requireRole("admin");

  let proposals = parseBrandDocLocally(body.text);
  let path = body.tier === "confidential" ? "Read locally · 0 data sent to AI (confidential document)" : "Read with the local parser · 0 data sent to AI";

  if (body.tier !== "confidential" && body.useAi && isAiConfigured()) {
    if (!allowAiCall(clientKey(request))) {
      path = "AI rate limit reached, read with the local parser · 0 data sent to AI";
    } else {
      try {
        proposals = await extractFromBrandDoc(body.text);
        path = `Document sent to ${aiModelLabel()} · ${body.text.length} chars`;
      } catch {
        path = "AI unavailable, read with the local parser";
      }
    }
  }
  return { path, facts: proposals.facts, rules: proposals.rules.map((r) => ({ ...r, config: configForProposal(r) })) };
});
