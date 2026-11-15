// POST /api/drafts/:id/review → the reviewer approves or requests changes.
// Approval is the end of the line: Ledgerly never publishes anything itself.
import { route, parseBody, requireRole, type IdParams } from "@/lib/api";
import { getDb } from "@/lib/db";
import { reviewSchema } from "@/lib/schemas";
import { reviewDraft } from "@/lib/services/review";

export const POST = route(async (request, { params }: IdParams) => {
  const body = await parseBody(request, reviewSchema);
  const user = await requireRole("reviewer", "admin");
  return reviewDraft(await getDb(), (await params).id, { ...body, actorId: user.id });
});
