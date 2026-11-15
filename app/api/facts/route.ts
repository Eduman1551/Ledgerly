// GET /api/facts → the Fact Ledger with version history. POST → add a fact (admin).
import { route, parseBody, requireRole } from "@/lib/api";
import { getDb } from "@/lib/db";
import { newFactSchema } from "@/lib/schemas";
import { createFact, listFacts } from "@/lib/services/ledger";

export const GET = route(async () => ({ facts: await listFacts(await getDb()) }));

export const POST = route(async (request) => {
  const body = await parseBody(request, newFactSchema);
  const user = await requireRole("admin");
  return { fact: await createFact(await getDb(), body, user.id) };
});
