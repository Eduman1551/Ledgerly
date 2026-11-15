// POST /api/issues/:id/decision → accept | edit | override one issue.
// Creators fix the text (accept/edit); reviewers may override a flag with a reason.
import { route, parseBody, requireRole, type IdParams } from "@/lib/api";
import { getDb } from "@/lib/db";
import { issueDecisionSchema } from "@/lib/schemas";
import { decideIssue } from "@/lib/services/review";

export const POST = route(async (request, { params }: IdParams) => {
  const body = await parseBody(request, issueDecisionSchema);
  const user = body.action === "override" ? await requireRole("reviewer", "admin") : await requireRole("creator", "admin");
  return decideIssue(await getDb(), (await params).id, { ...body, actorId: user.id });
});
