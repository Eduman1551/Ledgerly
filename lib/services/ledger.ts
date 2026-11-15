// Fact Ledger operations (workflow step 3). Old versions are never deleted:
// that history is what lets the engine say "Outdated" instead of just "wrong".
import { asc, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import type { Db } from "@/lib/db";
import { factVersions, facts, type ValueType } from "@/lib/db/schema";
import { normalizeValue, parseDate } from "@/lib/engine/normalize";
import type { newFactSchema, newFactVersionSchema } from "@/lib/schemas";
import { badRequest, notFound } from "./errors";

type NewFact = z.output<typeof newFactSchema>;
type NewFactVersion = z.output<typeof newFactVersionSchema>;

/**
 * Turn what the admin typed ("₹599", "3–5 business days", "1 Dec 2026", "yes")
 * into the canonical value the engine compares against.
 */
export function canonicalValue(raw: string, type: ValueType): string {
  const text = raw.trim();
  if (type === "boolean") {
    if (/^(true|yes|y|certified)$/i.test(text)) return "true";
    if (/^(false|no|n|not certified)$/i.test(text)) return "false";
    throw badRequest('A yes/no fact needs the value "yes" or "no".');
  }
  if (type === "text") return text;
  if (type === "date") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const d = parseDate(text);
    if (!d || d.year === undefined) throw badRequest('Write the date like "1 Dec 2026" or "2026-12-01".');
    return `${d.year}-${String(Math.floor(d.min / 100)).padStart(2, "0")}-${String(d.min % 100).padStart(2, "0")}`;
  }
  const norm = normalizeValue(text, type);
  if (!norm) throw badRequest(`"${text}" does not contain a number.`);
  if (type === "duration") {
    // Durations are stored as typed by the admin ("3-5"); the unit lives on the fact.
    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)/);
    return m ? `${m[1]}-${m[2]}` : (text.match(/\d+(?:\.\d+)?/)?.[0] ?? text);
  }
  return String(norm.min);
}

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50) || "fact";

export async function listFacts(db: Db) {
  const [factRows, versionRows] = await Promise.all([db.select().from(facts).orderBy(asc(facts.label)), db.select().from(factVersions).orderBy(desc(factVersions.versionNo))]);
  return factRows.map((f) => {
    const versions = versionRows.filter((v) => v.factId === f.id);
    return { ...f, versions, current: versions.find((v) => v.id === f.currentVersionId) ?? versions[0] ?? null };
  });
}

export async function createFact(db: Db, input: NewFact, actorId: string) {
  const value = canonicalValue(input.value, input.valueType);
  const existing = await db.select({ key: facts.key }).from(facts);
  let key = slug(input.label);
  if (existing.some((f) => f.key === key)) key = `${key}_${Date.now().toString(36)}`;

  const [fact] = await db.insert(facts).values({ key, label: input.label, aliases: input.aliases, valueType: input.valueType, unit: input.unit || null, tier: input.tier, owner: input.owner }).returning();
  const [version] = await db
    .insert(factVersions)
    .values({ factId: fact.id, versionNo: 1, value, displayValue: input.displayValue || input.value, sourceName: input.sourceName, sourceUrl: input.sourceUrl || null, effectiveFrom: input.effectiveFrom, createdBy: actorId })
    .returning();
  await db.update(facts).set({ currentVersionId: version.id }).where(eq(facts.id, fact.id));
  return { ...fact, currentVersionId: version.id };
}

/** Add a new version and make it current. Drafts that still use the old value are flagged Outdated on their next check. */
export async function addFactVersion(db: Db, factId: string, input: NewFactVersion, actorId: string) {
  const [fact] = await db.select().from(facts).where(eq(facts.id, factId));
  if (!fact) throw notFound("Fact");
  const value = canonicalValue(input.value, fact.valueType);
  const [latest] = await db.select().from(factVersions).where(eq(factVersions.factId, factId)).orderBy(desc(factVersions.versionNo)).limit(1);
  const [version] = await db
    .insert(factVersions)
    .values({ factId, versionNo: (latest?.versionNo ?? 0) + 1, value, displayValue: input.displayValue || input.value, sourceName: input.sourceName, sourceUrl: input.sourceUrl || null, effectiveFrom: input.effectiveFrom, createdBy: actorId })
    .returning();
  await db.update(facts).set({ currentVersionId: version.id }).where(eq(facts.id, factId));
  return version;
}

type ListedFact = Awaited<ReturnType<typeof listFacts>>[number];

const HIDDEN = { value: "", displayValue: "Hidden (confidential)" };

/** Hide confidential values from everyone except the brand owner. */
export function maskConfidential(list: ListedFact[]): ListedFact[] {
  return list.map((f) => {
    if (f.tier !== "confidential") return f;
    return { ...f, versions: f.versions.map((v) => ({ ...v, ...HIDDEN })), current: f.current && { ...f.current, ...HIDDEN } };
  });
}
