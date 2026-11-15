// Guideline (rule) operations. Editing a rule never overwrites it: it adds a
// new version, and issues keep pointing at the exact version they were checked against.
import { asc, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "@/lib/db";
import { ruleVersions, rules } from "@/lib/db/schema";
import type { newRuleSchema, newRuleVersionSchema } from "@/lib/schemas";
import { notFound } from "./errors";

type NewRule = z.output<typeof newRuleSchema>;
type NewRuleVersion = z.output<typeof newRuleVersionSchema>;

export async function listRules(db: Db) {
  const [ruleRows, versionRows] = await Promise.all([db.select().from(rules).orderBy(asc(rules.kind), asc(rules.title)), db.select().from(ruleVersions).orderBy(desc(ruleVersions.versionNo))]);
  return ruleRows.map((r) => {
    const versions = versionRows.filter((v) => v.ruleId === r.id);
    return { ...r, versions, current: versions.find((v) => v.id === r.currentVersionId) ?? versions[0] ?? null };
  });
}

export async function createRule(db: Db, input: NewRule, actorId: string) {
  const [rule] = await db.insert(rules).values({ kind: input.kind, title: input.title, tier: input.tier, severity: input.severity }).returning();
  const [version] = await db.insert(ruleVersions).values({ ruleId: rule.id, versionNo: 1, body: input.body, config: input.config, createdBy: actorId, changeNote: "Created" }).returning();
  await db.update(rules).set({ currentVersionId: version.id }).where(eq(rules.id, rule.id));
  return { ...rule, currentVersionId: version.id };
}

/** Save a rule edit as a new version and make it current. Config carries over unless replaced. */
export async function addRuleVersion(db: Db, ruleId: string, input: NewRuleVersion, actorId: string) {
  const [rule] = await db.select().from(rules).where(eq(rules.id, ruleId));
  if (!rule) throw notFound("Rule");
  const [latest] = await db.select().from(ruleVersions).where(eq(ruleVersions.ruleId, ruleId)).orderBy(desc(ruleVersions.versionNo)).limit(1);
  const [version] = await db
    .insert(ruleVersions)
    .values({ ruleId, versionNo: (latest?.versionNo ?? 0) + 1, body: input.body, config: input.config ?? latest?.config ?? {}, createdBy: actorId, changeNote: input.changeNote || "Edited by the brand owner" })
    .returning();
  await db.update(rules).set({ currentVersionId: version.id }).where(eq(rules.id, ruleId));
  return version;
}
