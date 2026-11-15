// POST /api/insights/:id/dismiss → keep the rule as it is.
import { route, requireRole, type IdParams } from "@/lib/api";
import { getDb } from "@/lib/db";
import { dismissSuggestion } from "@/lib/services/insights";

export const POST = route(async (_request, { params }: IdParams) => {
  await requireRole("admin");
  await dismissSuggestion(await getDb(), (await params).id);
  return { ok: true };
});
