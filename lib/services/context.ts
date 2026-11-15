// Loads everything the engine needs from the database: facts with their
// versions, active rules at their current version, the palette and names.
import { asc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { brandAssets, factVersions, facts, ruleVersions, rules, users } from "@/lib/db/schema";
import type { EngineFact, EngineRule } from "@/lib/engine/types";

export type EngineContext = { facts: EngineFact[]; rules: EngineRule[]; palette: string[]; personNames: string[] };

export async function loadEngineFacts(db: Db): Promise<EngineFact[]> {
  const [factRows, versionRows] = await Promise.all([db.select().from(facts), db.select().from(factVersions).orderBy(asc(factVersions.versionNo))]);
  return factRows
    .map((f) => ({
      id: f.id,
      key: f.key,
      label: f.label,
      aliases: f.aliases,
      valueType: f.valueType,
      unit: f.unit,
      tier: f.tier,
      currentVersionId: f.currentVersionId ?? "",
      versions: versionRows.filter((v) => v.factId === f.id),
    }))
    .filter((f) => f.versions.length > 0);
}

export async function loadEngineRules(db: Db): Promise<EngineRule[]> {
  const rows = await db.select({ rule: rules, version: ruleVersions }).from(rules).innerJoin(ruleVersions, eq(rules.currentVersionId, ruleVersions.id)).where(eq(rules.active, true));
  return rows.map(({ rule, version }) => ({
    id: rule.id,
    kind: rule.kind,
    title: rule.title,
    severity: rule.severity,
    tier: rule.tier,
    versionId: version.id,
    versionNo: version.versionNo,
    body: version.body,
    config: version.config ?? {},
  }));
}

export async function loadPalette(db: Db): Promise<{ name: string; hex: string }[]> {
  const assets = await db.select().from(brandAssets).where(eq(brandAssets.kind, "palette"));
  const colors = assets.flatMap((a) => (Array.isArray(a.data.colors) ? (a.data.colors as { name?: unknown; hex?: unknown }[]) : []));
  return colors.filter((c): c is { name: string; hex: string } => typeof c.hex === "string" && typeof c.name === "string");
}

export async function loadEngineContext(db: Db): Promise<EngineContext> {
  const [engineFacts, engineRules, palette, userRows] = await Promise.all([loadEngineFacts(db), loadEngineRules(db), loadPalette(db), db.select().from(users)]);
  return { facts: engineFacts, rules: engineRules, palette: palette.map((c) => c.hex), personNames: userRows.map((u) => u.name) };
}
