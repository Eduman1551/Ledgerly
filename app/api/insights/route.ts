// GET /api/insights → Governance Brain: KPIs, override rates, repeated mistakes, rewrite suggestions.
import { route } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getInsights } from "@/lib/services/insights";

export const dynamic = "force-dynamic";

export const GET = route(async () => getInsights(await getDb()));
