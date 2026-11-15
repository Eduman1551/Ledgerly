// POST /api/drafts/:id/check → run the check pipeline on the latest revision.
import { route, parseBody, type IdParams } from "@/lib/api";
import { aiForRequest } from "@/lib/ai/for-request";
import { getDb } from "@/lib/db";
import { checkSchema } from "@/lib/schemas";
import { checkDraft } from "@/lib/services/drafts";

export const maxDuration = 30;

export const POST = route(async (request, { params }: IdParams) => {
  const { useAi } = await parseBody(request, checkSchema);
  return checkDraft(await getDb(), (await params).id, aiForRequest(request, useAi));
});
