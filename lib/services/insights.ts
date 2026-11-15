// Governance Brain (workflow steps 10–12). Reads the decision log, finds rules
// that reviewers keep overriding ("vague rules") and repeated mistakes, and
// proposes guideline rewrites. A rewrite only takes effect when the admin accepts it.
import { desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { checkRuns, decisions, drafts, factVersions, facts, guidelineSuggestions, issues, revisions, ruleVersions, rules } from "@/lib/db/schema";
import { conflict, notFound } from "./errors";
import { addRuleVersion } from "./guidelines";

export const VAGUE_MIN_DECISIONS = 3;
export const VAGUE_MIN_OVERRIDE_RATE = 0.4;

export type RuleStat = { ruleId: string; title: string; kind: string; accepts: number; edits: number; overrides: number; total: number; overrideRate: number };

export type SuggestionEvidence = {
  ruleVersionId: string;
  ruleVersionNo: number;
  overrides: number;
  total: number;
  overrideRate: number;
  reasons: string[];
  channels: Record<string, number>;
  terms: Record<string, number>;
  proposedConfig: Record<string, unknown>;
  rewrittenBy: string; // "local template" or the AI model name
};

const countBy = <T>(items: T[], key: (item: T) => string | null | undefined) => {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    if (k) counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
};
const topKeys = (counts: Record<string, number>) => Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k]) => k);
const quoteList = (words: string[]) => words.map((w) => `"${w}"`).join(", ");
const CHANNEL_LABEL: Record<string, string> = { instagram: "Instagram", ad: "ads", email: "email", document: "documents" };

/** Load the whole decision history with the context each decision happened in. */
async function loadHistory(db: Db) {
  const [decisionRows, issueRows, runRows, revisionRows, draftRows, ruleRows, ruleVersionRows, factRows, factVersionRows] = await Promise.all([
    db.select().from(decisions),
    db.select().from(issues),
    db.select().from(checkRuns).orderBy(checkRuns.createdAt),
    db.select({ id: revisions.id, draftId: revisions.draftId, text: revisions.text }).from(revisions),
    db.select().from(drafts),
    db.select().from(rules),
    db.select().from(ruleVersions),
    db.select().from(facts),
    db.select().from(factVersions),
  ]);
  const issueById = new Map(issueRows.map((i) => [i.id, i]));
  const runById = new Map(runRows.map((r) => [r.id, r]));
  const revisionById = new Map(revisionRows.map((r) => [r.id, r]));
  const draftById = new Map(draftRows.map((d) => [d.id, d]));
  const ruleOfVersion = new Map(ruleVersionRows.map((v) => [v.id, v.ruleId]));
  const draftOfRun = (runId: string) => draftById.get(revisionById.get(runById.get(runId)?.revisionId ?? "")?.draftId ?? "");
  return { decisionRows, issueRows, runRows, revisionRows, draftRows, ruleRows, ruleVersionRows, factRows, factVersionRows, issueById, revisionById, ruleOfVersion, draftOfRun };
}

type History = Awaited<ReturnType<typeof loadHistory>>;
const isIssueDecision = (action: string) => action === "accept" || action === "edit" || action === "override";

function ruleStats(h: History): RuleStat[] {
  return h.ruleRows
    .map((rule) => {
      const mine = h.decisionRows.filter((d) => isIssueDecision(d.action) && d.ruleVersionId && h.ruleOfVersion.get(d.ruleVersionId) === rule.id);
      const overrides = mine.filter((d) => d.action === "override").length;
      return {
        ruleId: rule.id,
        title: rule.title,
        kind: rule.kind,
        accepts: mine.filter((d) => d.action === "accept").length,
        edits: mine.filter((d) => d.action === "edit").length,
        overrides,
        total: mine.length,
        overrideRate: mine.length ? overrides / mine.length : 0,
      };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.overrideRate - a.overrideRate || b.total - a.total);
}

/** What creators get wrong most often, counted on each draft's FIRST check (what they originally wrote). */
function repeatedMistakes(h: History) {
  const seenDrafts = new Set<string>();
  const firstRunIds = new Set<string>();
  for (const run of h.runRows) {
    const draftId = h.revisionById.get(run.revisionId)?.draftId;
    if (draftId && !seenDrafts.has(draftId)) {
      seenDrafts.add(draftId);
      firstRunIds.add(run.id);
    }
  }
  const factOfVersion = new Map(h.factVersionRows.map((v) => [v.id, v.factId]));
  const mistakes = h.issueRows.filter((i) => firstRunIds.has(i.checkRunId) && i.claimStatus !== "supported");
  const groups = new Map<string, { label: string; detail: string; count: number }>();
  for (const issue of mistakes) {
    const fact = h.factRows.find((f) => f.id === factOfVersion.get(issue.factVersionId ?? ""));
    const rule = h.ruleRows.find((r) => r.id === h.ruleOfVersion.get(issue.ruleVersionId ?? ""));
    const key = fact ? `fact:${fact.id}:${issue.claimStatus}` : `rule:${rule?.id}:${issue.excerpt.toLowerCase()}`;
    const label = fact ? `${issue.claimStatus === "outdated" ? "Outdated" : "Wrong"} ${fact.label.toLowerCase()}` : `"${issue.excerpt}"`;
    const detail = fact ? "Fact Ledger" : (rule?.title ?? "Rule");
    const group = groups.get(key) ?? { label, detail, count: 0 };
    group.count++;
    groups.set(key, group);
  }
  return [...groups.values()].filter((g) => g.count >= 2).sort((a, b) => b.count - a.count).slice(0, 6);
}

/** Rules whose CURRENT version is overridden often enough to look vague. */
function vagueRules(h: History) {
  return h.ruleRows.flatMap((rule) => {
    const version = h.ruleVersionRows.find((v) => v.id === rule.currentVersionId);
    if (!version || !rule.active) return [];
    const mine = h.decisionRows.filter((d) => isIssueDecision(d.action) && d.ruleVersionId === version.id);
    const overrides = mine.filter((d) => d.action === "override");
    const rate = mine.length ? overrides.length / mine.length : 0;
    if (mine.length < VAGUE_MIN_DECISIONS || rate < VAGUE_MIN_OVERRIDE_RATE) return [];
    const overriddenIssues = overrides.map((d) => h.issueById.get(d.issueId ?? "")).filter((i) => i !== undefined);
    return [
      {
        rule,
        version,
        overrides: overrides.length,
        total: mine.length,
        rate,
        reasons: overrides.map((d) => d.reason).filter((r): r is string => !!r),
        channels: countBy(overriddenIssues, (i) => h.draftOfRun(i.checkRunId)?.channel),
        terms: countBy(overriddenIssues, (i) => i.excerpt.toLowerCase()),
      },
    ];
  });
}

/**
 * Local (no-AI) rewrite proposal, built from what reviewers actually overrode.
 * For the tone rule: the overridden slang becomes allowed on the channels where
 * it was overridden, and stays banned elsewhere.
 */
export function proposeRewrite(input: { kind: string; body: string; config: Record<string, unknown>; terms: Record<string, number>; channels: Record<string, number>; reasons: string[] }) {
  const slang = Array.isArray(input.config.slang) ? (input.config.slang as string[]) : [];
  const overriddenSlang = topKeys(input.terms).filter((t) => slang.map((s) => s.toLowerCase()).includes(t));
  const channels = topKeys(input.channels);

  if (input.kind === "tone" && overriddenSlang.length > 0 && channels.length > 0) {
    const existing = (input.config.allowed_slang_by_channel as Record<string, string[]> | undefined) ?? {};
    const allowed: Record<string, string[]> = { ...existing };
    for (const ch of channels) allowed[ch] = [...new Set([...(existing[ch] ?? []), ...overriddenSlang])];
    const stillBanned = slang.filter((s) => !overriddenSlang.includes(s.toLowerCase()));
    const where = channels.map((c) => CHANNEL_LABEL[c] ?? c).join(" and ");
    const maxEmojis = typeof input.config.max_emojis === "number" ? input.config.max_emojis : 3;
    return {
      proposedBody: `Keep the voice warm, clear and friendly. Light Hinglish words such as ${quoteList(overriddenSlang)} are fine on ${where}, but not on other channels.${stillBanned.length ? ` Casual slang such as ${quoteList(stillBanned)} is not allowed anywhere.` : ""} Use at most ${maxEmojis} emojis and no ALL-CAPS words.`,
      proposedConfig: { ...input.config, allowed_slang_by_channel: allowed },
    };
  }
  const reason = input.reasons[0];
  return {
    proposedBody: `${input.body}${reason ? ` Exception agreed by reviewers: ${reason.replace(/\.$/, "")}.` : ""}`,
    proposedConfig: input.config,
  };
}

/** Create a pending suggestion for every vague rule version that does not have one yet. */
async function syncSuggestions(db: Db, h: History) {
  const existing = await db.select().from(guidelineSuggestions);
  for (const v of vagueRules(h)) {
    const already = existing.some((s) => s.ruleId === v.rule.id && (s.evidence as Partial<SuggestionEvidence>).ruleVersionId === v.version.id);
    if (already) continue;
    const { proposedBody, proposedConfig } = proposeRewrite({ kind: v.rule.kind, body: v.version.body, config: v.version.config, terms: v.terms, channels: v.channels, reasons: v.reasons });
    const topChannel = topKeys(v.channels)[0];
    const evidence: SuggestionEvidence = {
      ruleVersionId: v.version.id,
      ruleVersionNo: v.version.versionNo,
      overrides: v.overrides,
      total: v.total,
      overrideRate: v.rate,
      reasons: v.reasons,
      channels: v.channels,
      terms: v.terms,
      proposedConfig,
      rewrittenBy: "local template",
    };
    await db.insert(guidelineSuggestions).values({
      ruleId: v.rule.id,
      insight: `Reviewers override "${v.rule.title}" ${Math.round(v.rate * 100)}% of the time (${v.overrides} of ${v.total} decisions)${topChannel ? `, mostly on ${CHANNEL_LABEL[topChannel] ?? topChannel}` : ""}. The rule is probably too vague.`,
      evidence,
      proposedBody,
    });
  }
}

export async function getInsights(db: Db) {
  const h = await loadHistory(db);
  await syncSuggestions(db, h);

  // Latest run per draft, for "claims verified".
  const latestRunOfDraft = new Map<string, string>();
  for (const run of h.runRows) {
    const draftId = h.revisionById.get(run.revisionId)?.draftId;
    if (draftId) latestRunOfDraft.set(draftId, run.id); // runRows are oldest → newest
  }
  const latestRunIds = new Set(latestRunOfDraft.values());
  const localRuns = h.runRows.filter((r) => r.aiPath === "local_only" || r.aiPath === "ai_failed_fallback");

  const suggestionRows = await db.select().from(guidelineSuggestions).orderBy(desc(guidelineSuggestions.createdAt));
  const suggestions = suggestionRows.map((s) => {
    const rule = h.ruleRows.find((r) => r.id === s.ruleId);
    const evidence = s.evidence as SuggestionEvidence;
    const version = h.ruleVersionRows.find((v) => v.id === evidence.ruleVersionId);
    return { ...s, evidence, ruleTitle: rule?.title ?? "Rule", ruleTier: rule?.tier ?? "public", currentBody: version?.body ?? "" };
  });

  return {
    kpis: {
      draftsChecked: latestRunOfDraft.size,
      totalDrafts: h.draftRows.length,
      claimsVerified: h.issueRows.filter((i) => latestRunIds.has(i.checkRunId) && i.claimStatus === "supported").length,
      accepted: h.decisionRows.filter((d) => d.action === "accept" || d.action === "edit").length,
      overridden: h.decisionRows.filter((d) => d.action === "override").length,
      charsSentToAi: h.runRows.reduce((sum, r) => sum + r.charsSentToAi, 0),
      charsCheckedLocally: localRuns.reduce((sum, r) => sum + (h.revisionById.get(r.revisionId)?.text.length ?? 0), 0),
      aiChecks: h.runRows.length - localRuns.length,
      localChecks: localRuns.length,
    },
    ruleStats: ruleStats(h),
    repeatedMistakes: repeatedMistakes(h),
    suggestions,
  };
}

export type Insights = Awaited<ReturnType<typeof getInsights>>;

async function getPendingSuggestion(db: Db, id: string) {
  const [suggestion] = await db.select().from(guidelineSuggestions).where(eq(guidelineSuggestions.id, id));
  if (!suggestion) throw notFound("Suggestion");
  if (suggestion.status !== "pending") throw conflict("This suggestion has already been handled.");
  return suggestion;
}

/** Step 12: the accepted rewrite becomes a new guideline version, and later checks use it. */
export async function acceptSuggestion(db: Db, id: string, actorId: string) {
  const suggestion = await getPendingSuggestion(db, id);
  const evidence = suggestion.evidence as SuggestionEvidence;
  const version = await addRuleVersion(
    db,
    suggestion.ruleId,
    { body: suggestion.proposedBody, config: evidence.proposedConfig, changeNote: `Governance Brain rewrite accepted (v${evidence.ruleVersionNo} was overridden ${Math.round(evidence.overrideRate * 100)}% of the time)` },
    actorId,
  );
  await db.update(guidelineSuggestions).set({ status: "accepted" }).where(eq(guidelineSuggestions.id, id));
  return version;
}

export async function dismissSuggestion(db: Db, id: string) {
  await getPendingSuggestion(db, id);
  await db.update(guidelineSuggestions).set({ status: "dismissed" }).where(eq(guidelineSuggestions.id, id));
}

/** Replace the proposed wording (used when AI polishes the local template). */
export async function updateSuggestionBody(db: Db, id: string, proposedBody: string, rewrittenBy: string) {
  const suggestion = await getPendingSuggestion(db, id);
  const evidence = { ...(suggestion.evidence as SuggestionEvidence), rewrittenBy };
  await db.update(guidelineSuggestions).set({ proposedBody, evidence }).where(eq(guidelineSuggestions.id, id));
}

export { getPendingSuggestion };
