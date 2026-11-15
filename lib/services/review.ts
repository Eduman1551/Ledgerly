// Human-in-the-loop operations (workflow steps 7–10): accept / edit / override
// an issue, send to the reviewer, approve or request changes. Every action is
// logged in `decisions`, which is what the Governance Brain learns from.
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { checkRuns, comments, decisions, drafts, factVersions, issues, revisions } from "@/lib/db/schema";
import { applyReplacement, shiftSpan } from "@/lib/engine/apply";
import { getDraft, latestRevision, latestRun } from "./drafts";
import { badRequest, conflict, notFound } from "./errors";

export type IssueDecisionInput =
  | { action: "accept"; actorId: string }
  | { action: "edit"; actorId: string; text: string }
  | { action: "override"; actorId: string; reason: string };

async function loadIssueContext(db: Db, issueId: string) {
  const [row] = await db
    .select({ issue: issues, run: checkRuns, revision: revisions })
    .from(issues)
    .innerJoin(checkRuns, eq(issues.checkRunId, checkRuns.id))
    .innerJoin(revisions, eq(checkRuns.revisionId, revisions.id))
    .where(eq(issues.id, issueId));
  if (!row) throw notFound("Issue");
  const draft = await getDraft(db, row.revision.draftId);
  const newestRun = await latestRun(db, draft.id);
  if (newestRun?.id !== row.run.id) throw conflict("This issue belongs to an older check. Reload the page.");
  if (row.issue.state !== "open") throw conflict("This issue has already been handled.");
  if (draft.status === "approved") throw conflict("This draft is approved and locked.");
  return { ...row, draft };
}

/** Accept the suggestion, apply an edited fix, or override the flag with a reason. */
export async function decideIssue(db: Db, issueId: string, input: IssueDecisionInput, at?: Date) {
  const { issue, run, draft } = await loadIssueContext(db, issueId);
  const factId = issue.factVersionId ? ((await db.select({ factId: factVersions.factId }).from(factVersions).where(eq(factVersions.id, issue.factVersionId)))[0]?.factId ?? null) : null;
  const logDecision = (reason: string | null) =>
    db.insert(decisions).values({ draftId: draft.id, issueId, ruleVersionId: issue.ruleVersionId, factId, actorId: input.actorId, action: input.action, reason, ...(at ? { createdAt: at } : {}) });

  if (input.action === "override") {
    if (input.reason.trim().length < 3) throw badRequest("An override needs a reason.");
    await db.update(issues).set({ state: "overridden" }).where(eq(issues.id, issueId));
    await logDecision(input.reason.trim());
    return { draftId: draft.id };
  }

  // Accept / edit both change the text, which is only allowed before review.
  if (draft.status === "in_review") throw conflict("This draft is with the reviewer. Text changes are locked until they decide.");
  if (issue.spanStart === issue.spanEnd) throw badRequest("This issue is about the whole draft and needs a manual change.");
  const replacement = input.action === "accept" ? issue.replacement : input.text;
  if (replacement === null || replacement === undefined) throw badRequest("This issue has no automatic fix. Use Edit instead.");

  const current = await latestRevision(db, draft.id);
  const fix = applyReplacement(current.text, issue.spanStart, issue.spanEnd, replacement);
  const what = replacement === "" ? `removed "${issue.excerpt}"` : `"${issue.excerpt}" → "${replacement}"`;
  await db.insert(revisions).values({
    draftId: draft.id,
    revisionNo: current.revisionNo + 1,
    text: fix.text,
    imageUrl: current.imageUrl,
    imageAlt: current.imageAlt,
    imageColors: current.imageColors,
    note: `${input.action === "accept" ? "Accepted fix" : "Edited fix"}: ${what}`,
    createdBy: input.actorId,
    ...(at ? { createdAt: at } : {}),
  });

  // Keep the remaining highlights pointing at the right words in the new text.
  const siblings = await db.select().from(issues).where(eq(issues.checkRunId, run.id));
  await Promise.all(
    siblings.map((other) => {
      if (other.id === issueId) {
        return db
          .update(issues)
          .set({ state: input.action === "accept" ? "accepted" : "edited", spanStart: fix.start, spanEnd: fix.end })
          .where(eq(issues.id, issueId));
      }
      const moved = shiftSpan({ start: other.spanStart, end: other.spanEnd }, fix);
      if (moved.start === other.spanStart && moved.end === other.spanEnd) return null;
      return db.update(issues).set({ spanStart: moved.start, spanEnd: moved.end }).where(eq(issues.id, other.id));
    }),
  );

  await logDecision(input.action === "edit" ? `Changed to "${replacement}"` : null);
  if (draft.status === "changes_requested" || draft.status === "draft") {
    await db.update(drafts).set({ status: "checked" }).where(eq(drafts.id, draft.id));
  }
  return { draftId: draft.id };
}

async function openHighIssues(db: Db, draftId: string) {
  const run = await latestRun(db, draftId);
  if (!run) throw badRequest("Run a check before sending this draft on.");
  const rows = await db.select().from(issues).where(eq(issues.checkRunId, run.id));
  return rows.filter((i) => i.state === "open" && i.severity === "high");
}

/** Creator sends the draft to the reviewer. Blocked while a high-severity issue is open. */
export async function submitDraft(db: Db, draftId: string) {
  const draft = await getDraft(db, draftId);
  if (draft.status === "approved") throw conflict("This draft is already approved.");
  if (draft.status === "in_review") throw conflict("This draft is already with the reviewer.");
  const blocking = await openHighIssues(db, draftId);
  if (blocking.length > 0) throw badRequest(`Fix the ${blocking.length} high-severity issue${blocking.length === 1 ? "" : "s"} first.`);
  await db.update(drafts).set({ status: "in_review" }).where(eq(drafts.id, draftId));
  return { draftId };
}

/** Reviewer's final call. Ledgerly never publishes; "approved" only means ready to publish. */
export async function reviewDraft(db: Db, draftId: string, input: { action: "approve" | "request_changes"; actorId: string; comment?: string }, at?: Date) {
  const draft = await getDraft(db, draftId);
  if (draft.status !== "in_review") throw conflict("Only drafts that were sent to the reviewer can be approved or sent back.");
  const comment = input.comment?.trim() ?? "";
  if (input.action === "approve") {
    const blocking = await openHighIssues(db, draftId);
    if (blocking.length > 0) throw badRequest(`${blocking.length} high-severity issue${blocking.length === 1 ? " is" : "s are"} still open. Override with a reason or request changes.`);
  } else if (comment.length < 3) {
    throw badRequest("Tell the creator what to change.");
  }
  const stamp = at ? { createdAt: at } : {};
  await db.update(drafts).set({ status: input.action === "approve" ? "approved" : "changes_requested" }).where(eq(drafts.id, draftId));
  await db.insert(decisions).values({ draftId, actorId: input.actorId, action: input.action, reason: comment || null, ...stamp });
  if (comment) await db.insert(comments).values({ draftId, authorId: input.actorId, body: comment, ...stamp });
  return { draftId };
}

export async function addComment(db: Db, draftId: string, input: { actorId: string; body: string }) {
  await getDraft(db, draftId);
  if (input.body.trim().length < 1) throw badRequest("The comment is empty.");
  const [comment] = await db.insert(comments).values({ draftId, authorId: input.actorId, body: input.body.trim() }).returning();
  return comment;
}
