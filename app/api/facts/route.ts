// GET /api/facts → the Fact Ledger with version history. POST → add a fact (admin).
import { route, parseBody, requireRole } from "@/lib/api";
import { getDb } from "@/lib/db";
import { newFactSchema } from "@/lib/schemas";
import { getCurrentUser } from "@/lib/session";
import { createFact, listFacts, maskConfidential } from "@/lib/services/ledger";

export const GET = route(async () => {
  const [user, facts] = await Promise.all([getCurrentUser(), listFacts(await getDb())]);
  return { facts: user.role === "admin" ? facts : maskConfidential(facts) };
});

export const POST = route(async (request) => {
  const body = await parseBody(request, newFactSchema);
  const user = await requireRole("admin");
  return { fact: await createFact(await getDb(), body, user.id) };
});
