// POST /api/drafts/:id/revisions → save edited text as a new revision and
// re-check it straight away, so highlights always match the text on screen.
import { route, parseBody, type IdParams } from "@/lib/api";
import { aiForRequest } from "@/lib/ai/for-request";
import { getDb } from "@/lib/db";
import { newRevisionSchema } from "@/lib/schemas";
import { addRevision, checkDraft } from "@/lib/services/drafts";
import { getCurrentUser } from "@/lib/session";

export const maxDuration = 30;

export const POST = route(async (request, { params }: IdParams) => {
  const { id } = await params;
  const body = await parseBody(request, newRevisionSchema);
  const user = await getCurrentUser();
  const db = await getDb();
  const revision = await addRevision(db, id, { text: body.text, actorId: user.id, imageAlt: body.imageAlt ?? undefined });
  const check = await checkDraft(db, id, aiForRequest(request, body.useAi));
  return { revision, ...check };
});
