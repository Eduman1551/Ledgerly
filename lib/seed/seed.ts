// Wipes the database and loads the Kesar & Co. demo data. Used by
// `pnpm db:seed`, the "Reset demo data" button and the local PGlite fallback.
// Seeded drafts go through the real engine and the real review services, so the
// demo history is exactly what the app itself would have produced.
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { brandAssets, checkRuns, comments, decisions, drafts, factVersions, facts, guidelineSuggestions, issues, revisions, ruleVersions, rules, users } from "@/lib/db/schema";
import { checkDraft, createDraft, latestRun } from "@/lib/services/drafts";
import { decideIssue, reviewDraft, submitDraft } from "@/lib/services/review";
import { SEED_BRAND_VOICE, SEED_DRAFTS, SEED_FACTS, SEED_PALETTE, SEED_RULES, SEED_USERS, type SeedDraft } from "./data";

const DAY = 24 * 60 * 60 * 1000;

async function wipe(db: Db) {
  // Children first, so foreign keys never block a delete.
  for (const table of [guidelineSuggestions, comments, decisions, issues, checkRuns, revisions, drafts, ruleVersions, rules, factVersions, facts, brandAssets, users]) {
    await db.delete(table);
  }
}

async function seedReferenceData(db: Db) {
  await db.insert(users).values(SEED_USERS);

  await db.insert(facts).values(
    SEED_FACTS.map((f) => ({ id: f.id, key: f.key, label: f.label, aliases: f.aliases, valueType: f.valueType, unit: f.unit, tier: f.tier, owner: f.owner, currentVersionId: `${f.id}_v${f.versions.length}` })),
  );
  await db.insert(factVersions).values(
    SEED_FACTS.flatMap((f) =>
      f.versions.map((v, i) => ({ id: `${f.id}_v${i + 1}`, factId: f.id, versionNo: i + 1, ...v, createdBy: "user_meera", createdAt: new Date(`${v.effectiveFrom}T09:00:00+05:30`) })),
    ),
  );

  await db.insert(rules).values(SEED_RULES.map((r) => ({ id: r.id, kind: r.kind, title: r.title, tier: r.tier, severity: r.severity, currentVersionId: `${r.id}_v1` })));
  await db.insert(ruleVersions).values(
    SEED_RULES.map((r) => ({ id: `${r.id}_v1`, ruleId: r.id, versionNo: 1, body: r.body, config: r.config, createdBy: "user_meera", createdAt: new Date("2026-09-01T09:00:00+05:30"), changeNote: "Imported from the brand book" })),
  );

  await db.insert(brandAssets).values([
    { id: "asset_palette", name: "Kesar & Co. palette", kind: "palette", data: { colors: SEED_PALETTE }, tier: "public" },
    { id: "asset_voice", name: "Brand voice (brand book, page 4)", kind: "doc", data: { text: SEED_BRAND_VOICE }, tier: "internal" },
  ]);
}

/** Create one draft, check it locally, then replay its scripted history. */
async function seedDraft(db: Db, seed: SeedDraft, now: number) {
  let clock = now - seed.daysAgo * DAY - (seed.daysAgo === 0 ? 20 * 60 * 1000 : 0);
  const tick = () => new Date((clock += 4 * 60 * 1000));

  const created = await createDraft(db, { id: seed.id, title: seed.title, channel: seed.channel, tier: seed.tier, text: seed.text, authorId: "user_riya", createdAt: new Date(clock) });
  await checkDraft(db, created.id, null, tick()); // seed checks are always local: no AI calls

  for (const step of seed.steps) {
    if (step.do === "accept" || step.do === "override") {
      const run = await latestRun(db, created.id);
      const open = run ? await db.select().from(issues).where(eq(issues.checkRunId, run.id)) : [];
      const issue = open.find((i) => i.state === "open" && i.excerpt === step.match);
      if (!issue) throw new Error(`Seed: no open issue "${step.match}" in "${seed.title}"`);
      if (step.do === "accept") await decideIssue(db, issue.id, { action: "accept", actorId: "user_riya" }, tick());
      else await decideIssue(db, issue.id, { action: "override", actorId: "user_arjun", reason: step.reason }, tick());
    } else if (step.do === "submit") {
      await submitDraft(db, created.id);
    } else {
      await reviewDraft(db, created.id, { action: step.do, actorId: "user_arjun", comment: step.comment }, tick());
    }
  }
}

export async function seedDatabase(db: Db) {
  await wipe(db);
  await seedReferenceData(db);
  const now = Date.now();
  // Oldest first, so created_at order matches the story.
  for (const seed of [...SEED_DRAFTS].sort((a, b) => b.daysAgo - a.daysAgo)) {
    await seedDraft(db, seed, now);
  }
  return { users: SEED_USERS.length, facts: SEED_FACTS.length, rules: SEED_RULES.length, drafts: SEED_DRAFTS.length };
}
