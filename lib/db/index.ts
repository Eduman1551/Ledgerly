// Database access. With DATABASE_URL set we talk to Neon Postgres over HTTP.
// Without it (first run, CI, a teammate's laptop) we fall back to an in-memory
// Postgres (PGlite) that is migrated and seeded on start, so the app always runs.
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

const globalForDb = globalThis as { __ledgerlyDb?: Promise<Db> };

export const usingLocalDb = () => !process.env.DATABASE_URL;

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return drizzle(neon(url), { schema });
  const { createLocalDb } = await import("./local");
  return createLocalDb();
}

/** One shared connection per server process. */
export function getDb(): Promise<Db> {
  if (!globalForDb.__ledgerlyDb) {
    globalForDb.__ledgerlyDb = createDb().catch((error) => {
      globalForDb.__ledgerlyDb = undefined; // let the next request retry
      throw error;
    });
  }
  return globalForDb.__ledgerlyDb;
}

export { schema };
