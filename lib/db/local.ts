// Local fallback database: PGlite (Postgres compiled to WASM, in memory).
// Only used when DATABASE_URL is missing. Data resets when the server restarts.
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "./index";
import * as schema from "./schema";

export async function createLocalDb(): Promise<Db> {
  const client = new PGlite();
  const local = drizzle(client, { schema });
  await migrate(local, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  // PGlite and Neon expose the same Drizzle query API; only the driver differs.
  const db = local as unknown as Db;
  const { seedDatabase } = await import("@/lib/seed/seed");
  await seedDatabase(db);
  console.log("[ledgerly] DATABASE_URL not set: using in-memory PGlite with demo data.");
  return db;
}
