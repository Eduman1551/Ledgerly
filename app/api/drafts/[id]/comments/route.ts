// POST /api/drafts/:id/comments → add a comment to the draft's thread.
import { z } from "zod";
import { route, parseBody, type IdParams } from "@/lib/api";
import { getDb } from "@/lib/db";
import { addComment } from "@/lib/services/review";
import { getCurrentUser } from "@/lib/session";

const schema = z.object({ body: z.string().trim().min(1, "Write a comment first").max(1000) });

export const POST = route(async (request, { params }: IdParams) => {
  const body = await parseBody(request, schema);
  const user = await getCurrentUser();
  return { comment: await addComment(await getDb(), (await params).id, { actorId: user.id, body: body.body }) };
});
