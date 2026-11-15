// POST /api/facts/:id/versions → add a new version of a fact (old ones are kept).
import { route, parseBody, requireRole, type IdParams } from "@/lib/api";
import { getDb } from "@/lib/db";
import { newFactVersionSchema } from "@/lib/schemas";
import { addFactVersion } from "@/lib/services/ledger";

export const POST = route(async (request, { params }: IdParams) => {
  const body = await parseBody(request, newFactVersionSchema);
  const user = await requireRole("admin");
  return { version: await addFactVersion(await getDb(), (await params).id, body, user.id) };
});
