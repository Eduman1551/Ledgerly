// GET /api/drafts → inbox rows. POST /api/drafts → create a draft (first revision).
import { route, parseBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { newDraftSchema } from "@/lib/schemas";
import { createDraft, listDrafts } from "@/lib/services/drafts";
import { getCurrentUser } from "@/lib/session";

export const GET = route(async () => ({ drafts: await listDrafts(await getDb()) }));

export const POST = route(async (request) => {
  const body = await parseBody(request, newDraftSchema);
  const user = await getCurrentUser();
  const draft = await createDraft(await getDb(), { ...body, authorId: user.id });
  return { draft };
});
