// "Who is using the app" without any login: the chosen demo persona's id is
// kept in a cookie. Organiser rule: every link must open without sign-in.
import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { users, type Role } from "@/lib/db/schema";
import { SEED_USERS } from "@/lib/seed/data";

export const ROLE_COOKIE = "ledgerly_user";

export type CurrentUser = { id: string; name: string; role: Role };

/** The persona from the cookie, or Riya (creator) by default. Never throws. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const fallback = SEED_USERS[0];
  try {
    const id = (await cookies()).get(ROLE_COOKIE)?.value;
    if (!id) return fallback;
    const seeded = SEED_USERS.find((u) => u.id === id);
    if (seeded) return seeded;
    const db = await getDb();
    const all = await db.select().from(users);
    return all.find((u) => u.id === id) ?? fallback;
  } catch {
    return fallback;
  }
}
