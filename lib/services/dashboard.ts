// Data for the three role dashboards. Thin queries on top of the existing
// services, so the numbers always match the drafts inbox and Insights page.
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { decisions, drafts } from "@/lib/db/schema";
import { listDrafts } from "./drafts";

export async function getCreatorDashboard(db: Db, userId: string) {
  const [all, myDecisions] = await Promise.all([listDrafts(db), db.select({ action: decisions.action }).from(decisions).where(eq(decisions.actorId, userId))]);
  const mine = all.filter((d) => d.authorId === userId);
  return {
    drafts: mine,
    stats: {
      total: mine.length,
      checked: mine.filter((d) => d.checked).length,
      issuesFixed: myDecisions.filter((d) => d.action === "accept" || d.action === "edit").length,
      openIssues: mine.reduce((sum, d) => sum + d.openIssueCount, 0),
      approved: mine.filter((d) => d.status === "approved").length,
      needsWork: mine.filter((d) => d.status === "changes_requested" || (d.status === "checked" && d.openIssueCount > 0)).length,
    },
  };
}

export async function getReviewerDashboard(db: Db, userId: string) {
  const [all, myDecisions, approvals] = await Promise.all([
    listDrafts(db),
    db.select({ action: decisions.action }).from(decisions).where(eq(decisions.actorId, userId)),
    db
      .select({ draftId: decisions.draftId, at: decisions.createdAt })
      .from(decisions)
      .innerJoin(drafts, eq(decisions.draftId, drafts.id))
      .where(and(eq(decisions.action, "approve"), eq(drafts.status, "approved")))
      .orderBy(desc(decisions.createdAt)),
  ]);
  const byId = new Map(all.map((d) => [d.id, d]));
  const seen = new Set<string>();
  const recentlyApproved = approvals.flatMap((a) => {
    const draft = a.draftId ? byId.get(a.draftId) : undefined;
    if (!draft || seen.has(draft.id)) return [];
    seen.add(draft.id);
    return [{ ...draft, approvedAt: a.at }];
  });
  return {
    queue: all.filter((d) => d.status === "in_review"),
    recentlyApproved: recentlyApproved.slice(0, 5),
    stats: {
      waiting: all.filter((d) => d.status === "in_review").length,
      approved: myDecisions.filter((d) => d.action === "approve").length,
      overrides: myDecisions.filter((d) => d.action === "override").length,
      changesRequested: myDecisions.filter((d) => d.action === "request_changes").length,
    },
  };
}
