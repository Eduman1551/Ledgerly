"use client";
// The review screen: draft text with inline highlights on the left, the
// "N issues found" panel with the trust strip on the right, history below.
import { ArrowLeft, BadgeCheck, CheckCheck, ClipboardCopy, Loader2, Pencil, RefreshCw, Send, ShieldCheck, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-context";
import { ChannelBadge, LanguageBadge, StatusBadge, TierBadge } from "@/components/badges";
import { NativeSelect } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client/api";
import { trustStripText } from "@/lib/engine/trust";
import { formatDateTime, plural } from "@/lib/format";
import type { getDraftDetail } from "@/lib/services/drafts";
import { HighlightedText } from "./highlighted-text";
import { HistoryTabs } from "./history-tabs";
import { IssueCard, type IssueAction } from "./issue-card";

type Detail = Awaited<ReturnType<typeof getDraftDetail>>;

export function ReviewScreen({ detail }: { detail: Detail }) {
  const router = useRouter();
  const { user, aiEnabled } = useApp();
  const [working, setWorking] = useState<string | null>(null); // label of the action in flight
  const [refreshing, startRefresh] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewRevision, setViewRevision] = useState<number | null>(null); // null = latest
  const [dialog, setDialog] = useState<"edit" | "request_changes" | "approve" | null>(null);
  const [dialogText, setDialogText] = useState("");

  const { draft, run, issues } = detail;
  const latest = detail.revisions[detail.revisions.length - 1];
  const shown = viewRevision === null ? latest : (detail.revisions.find((r) => r.revisionNo === viewRevision) ?? latest);
  const viewingLatest = shown.id === latest.id;
  const busy = working !== null || refreshing;

  const flagged = useMemo(() => issues.filter((i) => i.claimStatus !== "supported"), [issues]);
  const verified = useMemo(() => issues.filter((i) => i.claimStatus === "supported"), [issues]);
  const open = flagged.filter((i) => i.state === "open");
  const openHigh = open.filter((i) => i.severity === "high");
  const fixable = open.filter((i) => i.replacement !== null && i.spanEnd > i.spanStart);
  const fixedCount = flagged.length - open.length;

  const locked = draft.status === "approved";
  const inReview = draft.status === "in_review";
  const canFix = (user.role === "creator" || user.role === "admin") && !locked && !inReview;
  const canOverride = (user.role === "reviewer" || user.role === "admin") && !locked;
  const canReview = (user.role === "reviewer" || user.role === "admin") && inReview;
  const textChangedSinceCheck = run !== null && run.revisionId !== latest.id;

  /** Run one server action, show errors as a toast, then reload the page data. */
  async function act(label: string, fn: () => Promise<unknown>, success?: string): Promise<boolean> {
    setWorking(label);
    try {
      await fn();
      if (success) toast.success(success);
      startRefresh(() => router.refresh());
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      startRefresh(() => router.refresh());
      return false;
    } finally {
      setWorking(null);
    }
  }

  const recheck = () => act("check", () => api(`/api/drafts/${draft.id}/check`, { body: { useAi: aiEnabled } }), "Check complete");

  const onIssueAction = (issueId: string, action: IssueAction) =>
    action.action === "comment"
      ? act("comment", () => api(`/api/drafts/${draft.id}/comments`, { body: { body: action.body } }), "Comment posted")
      : act(action.action, () => api(`/api/issues/${issueId}/decision`, { body: action }), action.action === "override" ? "Override logged with your reason" : "Fix applied as a new revision");

  const acceptAll = () =>
    act(
      "accept-all",
      async () => {
        for (const issue of fixable) await api(`/api/issues/${issue.id}/decision`, { body: { action: "accept" } });
      },
      `${plural(fixable.length, "fix")} applied`,
    );

  const selectIssue = (id: string) => {
    setActiveId(id);
    document.getElementById(`issue-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  async function submitDialog() {
    const text = dialogText.trim();
    let ok = false;
    if (dialog === "edit") ok = await act("edit-text", () => api(`/api/drafts/${draft.id}/revisions`, { body: { text, useAi: aiEnabled } }), "Saved as a new revision and re-checked");
    if (dialog === "request_changes") ok = await act("review", () => api(`/api/drafts/${draft.id}/review`, { body: { action: "request_changes", comment: text } }), "Sent back to the creator");
    if (dialog === "approve") ok = await act("review", () => api(`/api/drafts/${draft.id}/review`, { body: { action: "approve", comment: text || undefined } }), "Approved. Ready to publish.");
    if (ok) setDialog(null);
  }

  const copyFinal = async () => {
    try {
      await navigator.clipboard.writeText(latest.text);
      toast.success("Final text copied");
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Link href="/drafts" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> All drafts
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{draft.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={draft.status} />
            <ChannelBadge channel={draft.channel} />
            <TierBadge tier={draft.tier} />
            {run && <LanguageBadge language={run.language} />}
            <span className="text-xs text-muted-foreground">
              by {draft.authorName} · {formatDateTime(draft.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!locked && (
            <Button variant="outline" onClick={recheck} disabled={busy}>
              {working === "check" ? <Loader2 className="animate-spin" /> : <RefreshCw />} {run ? "Re-check" : "Run check"}
            </Button>
          )}
          {canFix && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setDialogText(latest.text);
                setDialog("edit");
              }}
            >
              <Pencil /> Edit text
            </Button>
          )}
          {canFix && run && (
            <Button onClick={() => act("submit", () => api(`/api/drafts/${draft.id}/submit`, { method: "POST" }), "Sent to the reviewer")} disabled={busy || openHigh.length > 0} title={openHigh.length > 0 ? `Fix the ${plural(openHigh.length, "high-severity issue")} first` : "Send to the reviewer for final approval"}>
              <Send /> Send to reviewer
            </Button>
          )}
          {canReview && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setDialogText("");
                  setDialog("request_changes");
                }}
              >
                <Undo2 /> Request changes
              </Button>
              <Button
                disabled={busy || openHigh.length > 0}
                title={openHigh.length > 0 ? "Override the open high-severity issues with a reason, or request changes" : "Approve this draft"}
                onClick={() => {
                  setDialogText("");
                  setDialog("approve");
                }}
              >
                <BadgeCheck /> Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status banners */}
      {locked && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-900">
          <BadgeCheck className="size-5" />
          <div className="flex-1">
            <p className="font-semibold">Approved, ready to publish</p>
            <p className="text-sm">Ledgerly never publishes for you. Copy the final text and post it where it belongs.</p>
          </div>
          <Button variant="outline" onClick={copyFinal}>
            <ClipboardCopy /> Copy final text
          </Button>
        </div>
      )}
      {inReview && <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-900">{canReview ? "This draft is waiting for your decision. Override a flag with a reason, then approve or request changes." : "This draft is with the reviewer. The text is locked until they approve it or send it back."}</div>}
      {draft.status === "changes_requested" && detail.comments[0] && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <strong>{detail.comments[0].authorName} requested changes:</strong> {detail.comments[0].body}
        </div>
      )}
      {canFix && run && openHigh.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <strong className="text-red-700">{plural(openHigh.length, "high-severity issue")}</strong> must be fixed before this can go to the reviewer.
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Left: the draft */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-border bg-white p-5" aria-label="Draft text">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label htmlFor="revision" className="text-xs font-medium text-muted-foreground">
                Revision
              </label>
              <NativeSelect id="revision" className="h-7 w-auto text-xs" value={shown.revisionNo} onChange={(e) => setViewRevision(Number(e.target.value) === latest.revisionNo ? null : Number(e.target.value))}>
                {detail.revisions.map((r) => (
                  <option key={r.id} value={r.revisionNo}>
                    {r.revisionNo}
                    {r.id === latest.id ? " (latest)" : ""}
                  </option>
                ))}
              </NativeSelect>
              {!viewingLatest && <span className="text-xs text-amber-700">Viewing an older revision (read-only, no highlights)</span>}
              {viewingLatest && textChangedSinceCheck && <span className="text-xs text-muted-foreground">Fixes applied since the last check. Re-check to verify the new text.</span>}
            </div>
            {viewingLatest && run ? <HighlightedText text={latest.text} issues={issues} activeId={activeId} onSelect={selectIssue} /> : <p className="text-[17px] leading-9 whitespace-pre-wrap">{shown.text}</p>}
            {shown.imageUrl && (
              <figure className="mt-4 flex items-start gap-3 border-t border-border pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- small data URL preview */}
                <img src={shown.imageUrl} alt={shown.imageAlt || "Attached image without alt text"} className="h-28 w-28 rounded-md border border-border object-cover" />
                <figcaption className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Attached image</span>
                  <span className="text-muted-foreground">Alt text: {shown.imageAlt || <em className="text-red-700">missing</em>}</span>
                  {shown.imageColors && (
                    <span className="flex items-center gap-1" aria-label="Dominant colours">
                      {shown.imageColors.map((c) => (
                        <span key={c} title={c} className="size-4 rounded border border-border" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                  )}
                </figcaption>
              </figure>
            )}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground" aria-label="Highlight legend">
              {[
                ["hl-supported", "Supported"],
                ["hl-outdated", "Outdated"],
                ["hl-conflicting", "Conflicting"],
                ["hl-unsupported", "Unsupported / banned"],
                ["hl-tone", "Tone"],
                ["hl-done", "Handled"],
              ].map(([cls, label]) => (
                <span key={cls} className="flex items-center gap-1.5">
                  <span className={`hl ${cls} px-1`}>Aa</span> {label}
                </span>
              ))}
            </div>
          </section>

          <HistoryTabs detail={detail} busy={busy} onComment={(body) => act("comment", () => api(`/api/drafts/${draft.id}/comments`, { body: { body } }), "Comment posted")} />
        </div>

        {/* Right: issues panel */}
        <aside className="flex flex-col gap-3 rounded-xl bg-muted p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]" aria-label="Issues">
          {!run ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <ShieldCheck className="size-7 text-muted-foreground" />
              <p className="font-medium">This draft has not been checked yet</p>
              <p className="text-sm text-muted-foreground">Run a check to verify every claim against the Fact Ledger and the brand guidelines.</p>
              <Button onClick={recheck} disabled={busy}>
                {working === "check" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Run check
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 px-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{flagged.length === 0 ? "No issues found" : `${plural(flagged.length, "issue")} found`}</h2>
                  {canFix && fixable.length > 1 && (
                    <Button size="sm" variant="outline" onClick={acceptAll} disabled={busy}>
                      {working === "accept-all" ? <Loader2 className="animate-spin" /> : <CheckCheck />} Accept all {fixable.length} fixes
                    </Button>
                  )}
                </div>
                {flagged.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={flagged.length} aria-valuenow={fixedCount} aria-label="Issues handled">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(fixedCount / flagged.length) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {fixedCount} of {flagged.length} fixed
                    </span>
                  </div>
                )}
              </div>

              <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-0.5">
                {flagged.length === 0 && <p className="rounded-lg bg-white p-4 text-sm text-muted-foreground">Nothing to fix. Every claim in this draft is backed by the Fact Ledger and no rule is broken.</p>}
                {[...open, ...flagged.filter((i) => i.state !== "open")].map((issue) => (
                  <IssueCard key={issue.id} issue={issue} active={activeId === issue.id} busy={busy} canFix={canFix} canOverride={canOverride} onSelect={() => setActiveId(issue.id)} onAction={(action) => onIssueAction(issue.id, action)} />
                ))}
                {verified.length > 0 && (
                  <details className="rounded-lg bg-white p-3 text-sm" open={flagged.length === 0}>
                    <summary className="cursor-pointer font-medium text-green-800">{plural(verified.length, "claim")} verified against the ledger</summary>
                    <div className="mt-2 flex flex-col gap-2">
                      {verified.map((issue) => (
                        <IssueCard key={issue.id} issue={issue} active={activeId === issue.id} busy={busy} canFix={false} canOverride={false} onSelect={() => setActiveId(issue.id)} onAction={async () => false} />
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* Trust strip: what, if anything, left the server. */}
              <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900" role="status" aria-label="AI disclosure">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">{trustStripText(run)}</p>
                  <p className="text-teal-800/80">
                    Ledger matching always runs locally · checked {formatDateTime(run.createdAt)} in {run.durationMs} ms
                  </p>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Edit text / request changes / approve dialogs */}
      <Dialog open={dialog !== null} onOpenChange={(next) => !next && !busy && setDialog(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialog === "edit" ? "Edit draft text" : dialog === "approve" ? "Approve this draft" : "Request changes"}</DialogTitle>
            <DialogDescription>
              {dialog === "edit" && "Saving creates a new revision and re-checks it straight away."}
              {dialog === "approve" && "Approval marks the draft as ready to publish. Ledgerly does not publish anything."}
              {dialog === "request_changes" && "Tell the creator what needs to change. They will see this on the draft."}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={dialogText} onChange={(e) => setDialogText(e.target.value)} rows={dialog === "edit" ? 8 : 3} maxLength={dialog === "edit" ? 5000 : 1000} aria-label={dialog === "edit" ? "Draft text" : "Comment"} placeholder={dialog === "approve" ? "Optional note for the creator" : dialog === "request_changes" ? "What should change?" : ""} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitDialog} disabled={busy || (dialog !== "approve" && dialogText.trim().length < 3)}>
              {busy && <Loader2 className="animate-spin" />}
              {dialog === "edit" ? "Save and re-check" : dialog === "approve" ? "Approve" : "Send back to creator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
