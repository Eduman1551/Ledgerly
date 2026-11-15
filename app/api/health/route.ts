// GET /api/health → is the database reachable, is AI configured?
// GET /api/health?probe=1 also makes one tiny real AI call.
import { z } from "zod";
import { route } from "@/lib/api";
import { aiModelId, aiModelLabel, generateStructured, isAiConfigured } from "@/lib/ai/client";
import { allowAiCall, clientKey } from "@/lib/ai/rate-limit";
import { getDb, usingLocalDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const GET = route(async (request) => {
  let dbOk = false;
  let dbError: string | null = null;
  try {
    const db = await getDb();
    dbOk = (await db.select().from(users).limit(1)).length > 0;
    if (!dbOk) dbError = "The database is empty. Use Reset demo data.";
  } catch (error) {
    dbError = error instanceof Error ? error.message.slice(0, 200) : "Database error";
  }

  const ai = { configured: isAiConfigured(), model: aiModelId(), label: aiModelLabel(), probed: false, ok: null as boolean | null, error: null as string | null, ms: null as number | null };
  if (new URL(request.url).searchParams.get("probe") && ai.configured) {
    ai.probed = true;
    if (!allowAiCall(clientKey(request), 4)) {
      ai.ok = false;
      ai.error = "Rate limit reached. Try again in a minute.";
    } else {
      const started = Date.now();
      try {
        await generateStructured({ schema: z.object({ ok: z.boolean() }), system: "Reply with ok=true.", prompt: "ping" });
        ai.ok = true;
      } catch (error) {
        ai.ok = false;
        ai.error = error instanceof Error ? error.message.slice(0, 200) : "AI error";
      }
      ai.ms = Date.now() - started;
    }
  }
  return { ok: dbOk, db: { kind: usingLocalDb() ? "pglite (in-memory, local fallback)" : "neon postgres", ok: dbOk, error: dbError }, ai };
});
