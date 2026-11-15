// Draft, revision and check-run operations (workflow steps 4–6).
import { desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { checkRuns, comments, decisions, drafts, factVersions, facts, issues, revisions, ruleVersions, rules, users, type Channel, type Tier } from "@/lib/db/schema";
import { runCheck } from "@/lib/engine/pipeline";
import type { AiAdapter } from "@/lib/engine/types";
import { loadEngineContext } from "./context";
import { badRequest, conflict, notFound } from "./errors";

export type NewDraftInput = {
  title: string;
  channel: Channel;
  tier: Tier;
  text: string;
  authorId: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageColors?: string[] | null;
  createdAt?: Date; // only the seed sets this
  id?: string; // only the seed sets this (stable demo URLs)
};

export async function createDraft(db: Db, input: NewDraftInput) {
  const at = input.createdAt ?? new Date();
  const [draft] = await db.insert(drafts).values({ ...(input.id ? { id: input.id } : {}), title: input.title, channel: input.channel, tier: input.tier, authorId: input.authorId, createdAt: at }).returning();
  await db.insert(revisions).values({
    draftId: draft.id,
    revisionNo: 1,
    text: input.text,
    imageUrl: input.imageUrl ?? null,
    imageAlt: input.imageAlt ?? null,
    imageColors: input.imageColors ?? null,
    note: "First version",
    createdBy: input.authorId,
    createdAt: at,
  });
  return draft;
}

export async function getDraft(db: Db, draftId: string) {
  const [draft] = await db.select().from(drafts).where(eq(drafts.id, draftId));
  if (!draft) throw notFound("Draft");
  return draft;
}

export async function latestRevision(db: Db, draftId: string) {
  const [revision] = await db.select().from(revisions).where(eq(revisions.draftId, draftId)).orderBy(desc(revisions.revisionNo)).limit(1);
  if (!revision) throw notFound("Revision");
  return revision;
}

/** The newest check run of a draft (across all its revisions), or null. */
export async function latestRun(db: Db, draftId: string) {
  const [row] = await db
    .select({ run: checkRuns })
    .from(checkRuns)
    .innerJoin(revisions, eq(checkRuns.revisionId, revisions.id))
    .where(eq(revisions.draftId, draftId))
    .orderBy(desc(checkRuns.createdAt))
    .limit(1);
  return row?.run ?? null;
}

/** Run the engine on the latest revision and save the check run + issues. */
export async function checkDraft(db: Db, draftId: string, ai: AiAdapter | null, at?: Date) {
  const draft = await getDraft(db, draftId);
  if (draft.status === "approved") throw conflict("This draft is approved and locked.");
  const [revision, context, previousRun] = await Promise.all([latestRevision(db, draftId), loadEngineContext(db), latestRun(db, draftId)]);

  const result = await runCheck(
    {
      text: revision.text,
      channel: draft.channel,
      tier: draft.tier,
      hasImage: Boolean(revision.imageUrl),
      imageAlt: revision.imageAlt,
      imageColors: revision.imageColors,
      ...context,
    },
    ai,
  );

  // A reviewer's override survives a re-check: same words + same rule/fact.
  const previousOverrides = previousRun ? (await db.select().from(issues).where(eq(issues.checkRunId, previousRun.id))).filter((i) => i.state === "overridden") : [];
  const wasOverridden = (i: (typeof result.issues)[number]) => previousOverrides.some((p) => p.excerpt === i.excerpt && p.kind === i.kind && p.ruleVersionId === i.ruleVersionId && p.factVersionId === i.factVersionId);

  const [run] = await db
    .insert(checkRuns)
    .values({
      revisionId: revision.id,
      language: result.language,
      aiPath: result.aiPath,
      model: result.model,
      charsSentToAi: result.charsSentToAi,
      redactionsCount: result.redactionsCount,
      durationMs: result.durationMs,
      ...(at ? { createdAt: at } : {}),
    })
    .returning();

  const saved = result.issues.length
    ? await db
        .insert(issues)
        .values(result.issues.map((i) => ({ ...i, checkRunId: run.id, state: i.state === "open" && wasOverridden(i) ? ("overridden" as const) : i.state })))
        .returning()
    : [];

  if (draft.status === "draft" || draft.status === "changes_requested") {
    await db.update(drafts).set({ status: "checked" }).where(eq(drafts.id, draftId));
  }
  return { run, issues: saved };
}

/** Save an edited text as a new revision. The caller re-checks right after, so highlights always match the text. */
export async function addRevision(db: Db, draftId: string, input: { text: string; actorId: string; note?: string; imageAlt?: string | null }) {
  const draft = await getDraft(db, draftId);
  if (draft.status === "approved") throw conflict("This draft is approved and locked.");
  if (draft.status === "in_review") throw conflict("This draft is with the reviewer. Wait for their decision before editing.");
  if (!input.text.trim()) throw badRequest("The draft text cannot be empty.");
  const previous = await latestRevision(db, draftId);
  const [revision] = await db
    .insert(revisions)
    .values({
      draftId,
      revisionNo: previous.revisionNo + 1,
      text: input.text,
      imageUrl: previous.imageUrl,
      imageAlt: input.imageAlt === undefined ? previous.imageAlt : input.imageAlt,
      imageColors: previous.imageColors,
      note: input.note ?? "Edited by hand",
      createdBy: input.actorId,
    })
    .returning();
  return revision;
}

export type IssueView = Awaited<ReturnType<typeof getDraftDetail>>["issues"][number];

/** Everything the review screen shows for one draft. */
export async function getDraftDetail(db: Db, draftId: string) {
  const draft = await getDraft(db, draftId);
  const [revisionRows, run, userRows, decisionRows, commentRows] = await Promise.all([
    db.select().from(revisions).where(eq(revisions.draftId, draftId)).orderBy(revisions.revisionNo),
    latestRun(db, draftId),
    db.select().from(users),
    db.select().from(decisions).where(eq(decisions.draftId, draftId)).orderBy(desc(decisions.createdAt)),
    db.select().from(comments).where(eq(comments.draftId, draftId)).orderBy(desc(comments.createdAt)),
  ]);
  const issueRows = run ? await db.select().from(issues).where(eq(issues.checkRunId, run.id)).orderBy(issues.spanStart, issues.spanEnd) : [];

  // Citations: which fact version / rule version each issue points at.
  const factVersionIds = [...new Set(issueRows.map((i) => i.factVersionId).filter((x): x is string => !!x))];
  const ruleVersionIds = [...new Set([...issueRows.map((i) => i.ruleVersionId), ...decisionRows.map((d) => d.ruleVersionId)].filter((x): x is string => !!x))];
  const [factCites, ruleCites] = await Promise.all([
    factVersionIds.length
      ? db.select({ version: factVersions, fact: facts }).from(factVersions).innerJoin(facts, eq(factVersions.factId, facts.id)).where(inArray(factVersions.id, factVersionIds))
      : [],
    ruleVersionIds.length
      ? db.select({ version: ruleVersions, rule: rules }).from(ruleVersions).innerJoin(rules, eq(ruleVersions.ruleId, rules.id)).where(inArray(ruleVersions.id, ruleVersionIds))
      : [],
  ]);

  const name = (id: string | null) => userRows.find((u) => u.id === id)?.name ?? "Unknown";
  const allIssueIds = decisionRows.map((d) => d.issueId).filter((x): x is string => !!x);
  const decidedIssues = allIssueIds.length ? await db.select({ id: issues.id, excerpt: issues.excerpt }).from(issues).where(inArray(issues.id, allIssueIds)) : [];

  return {
    draft: { ...draft, authorName: name(draft.authorId) },
    revisions: revisionRows.map((r) => ({ ...r, createdByName: name(r.createdBy) })),
    run,
    issues: issueRows.map((i) => {
      const f = factCites.find((c) => c.version.id === i.factVersionId);
      const r = ruleCites.find((c) => c.version.id === i.ruleVersionId);
      return {
        ...i,
        fact: f ? { label: f.fact.label, displayValue: f.version.displayValue, sourceName: f.version.sourceName, versionNo: f.version.versionNo, effectiveFrom: f.version.effectiveFrom } : null,
        rule: r ? { title: r.rule.title, versionNo: r.version.versionNo, body: r.version.body } : null,
      };
    }),
    decisions: decisionRows.map((d) => ({
      ...d,
      actorName: name(d.actorId),
      excerpt: decidedIssues.find((i) => i.id === d.issueId)?.excerpt ?? null,
      ruleTitle: ruleCites.find((c) => c.version.id === d.ruleVersionId)?.rule.title ?? null,
    })),
    comments: commentRows.map((c) => ({ ...c, authorName: name(c.authorId) })),
  };
}

/** Rows for the drafts inbox: each draft with its open-issue count. */
export async function listDrafts(db: Db) {
  const [draftRows, userRows, revisionRows, runRows] = await Promise.all([
    db.select().from(drafts).orderBy(desc(drafts.createdAt)),
    db.select().from(users),
    db.select({ id: revisions.id, draftId: revisions.draftId }).from(revisions),
    db.select({ id: checkRuns.id, revisionId: checkRuns.revisionId, createdAt: checkRuns.createdAt, language: checkRuns.language }).from(checkRuns).orderBy(desc(checkRuns.createdAt)),
  ]);
  const draftOfRevision = new Map(revisionRows.map((r) => [r.id, r.draftId]));
  const latestRunByDraft = new Map<string, (typeof runRows)[number]>();
  for (const run of runRows) {
    const draftId = draftOfRevision.get(run.revisionId);
    if (draftId && !latestRunByDraft.has(draftId)) latestRunByDraft.set(draftId, run);
  }
  const runIds = [...latestRunByDraft.values()].map((r) => r.id);
  const openIssues = runIds.length ? await db.select({ checkRunId: issues.checkRunId, state: issues.state }).from(issues).where(inArray(issues.checkRunId, runIds)) : [];

  return draftRows.map((d) => {
    const run = latestRunByDraft.get(d.id);
    return {
      ...d,
      authorName: userRows.find((u) => u.id === d.authorId)?.name ?? "Unknown",
      language: run?.language ?? null,
      checked: Boolean(run),
      openIssueCount: run ? openIssues.filter((i) => i.checkRunId === run.id && i.state === "open").length : 0,
    };
  });
}
