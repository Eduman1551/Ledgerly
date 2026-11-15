// POST /api/insights/:id/accept → the proposed rewrite becomes a new rule version.
import { route, requireRole, type IdParams } from "@/lib/api";
import { getDb } from "@/lib/db";
import { acceptSuggestion } from "@/lib/services/insights";

export const POST = route(async (_request, { params }: IdParams) => {
  const user = await requireRole("admin");
  return { version: await acceptSuggestion(await getDb(), (await params).id, user.id) };
});
