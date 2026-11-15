// POST /api/demo/reset → wipe everything and reload the Kesar & Co. demo data.
// Open to every persona on purpose: judges share one database.
import { route } from "@/lib/api";
import { getDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed/seed";

export const maxDuration = 60;

export const POST = route(async () => ({ ok: true, seeded: await seedDatabase(await getDb()) }));
