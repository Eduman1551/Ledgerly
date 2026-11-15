// POST /api/rules/:id/versions → edit a rule by adding a new version.
import { route, parseBody, requireRole, type IdParams } from "@/lib/api";
import { getDb } from "@/lib/db";
import { newRuleVersionSchema } from "@/lib/schemas";
import { addRuleVersion } from "@/lib/services/guidelines";

export const POST = route(async (request, { params }: IdParams) => {
  const body = await parseBody(request, newRuleVersionSchema);
  const user = await requireRole("admin");
  return { version: await addRuleVersion(await getDb(), (await params).id, body, user.id) };
});
