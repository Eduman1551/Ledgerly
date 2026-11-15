// GET /api/drafts/:id → everything the review screen shows. PATCH → rename.
import { eq } from "drizzle-orm";
import { route, parseBody, type IdParams } from "@/lib/api";
import { getDb } from "@/lib/db";
import { drafts } from "@/lib/db/schema";
import { patchDraftSchema } from "@/lib/schemas";
import { getDraft, getDraftDetail } from "@/lib/services/drafts";
import { addComment } from "@/lib/services/review";
import { getCurrentUser } from "@/lib/session";

export const GET = route(async (_request, { params }: IdParams) => getDraftDetail(await getDb(), (await params).id));

export const PATCH = route(async (request, { params }: IdParams) => {
  const { id } = await params;
  const body = await parseBody(request, patchDraftSchema);
  const db = await getDb();
  await getDraft(db, id);
  if (body.title) await db.update(drafts).set({ title: body.title }).where(eq(drafts.id, id));
  if (body.comment) await addComment(db, id, { actorId: (await getCurrentUser()).id, body: body.comment });
  return { draft: await getDraft(db, id) };
});
