// `pnpm db:seed`: load the demo data into the database from .env.local.
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL is not set. Nothing to seed: the app seeds its in-memory database by itself on start.");
    return;
  }
  const { getDb } = await import("../lib/db");
  const { seedDatabase } = await import("../lib/seed/seed");
  const result = await seedDatabase(await getDb());
  console.log("Seeded demo data:", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
