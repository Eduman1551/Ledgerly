// GET /api/rules → guidelines with version history. POST → add a rule (admin).
import { route, parseBody, requireRole } from "@/lib/api";
import { getDb } from "@/lib/db";
import { newRuleSchema } from "@/lib/schemas";
import { createRule, listRules } from "@/lib/services/guidelines";

export const GET = route(async () => ({ rules: await listRules(await getDb()) }));

export const POST = route(async (request) => {
  const body = await parseBody(request, newRuleSchema);
  const user = await requireRole("admin");
  return { rule: await createRule(await getDb(), body, user.id) };
});
