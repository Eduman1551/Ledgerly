"use client";
// One issue: status chip, excerpt → suggestion, why it was flagged, the cited
// fact or rule version, and the actions the current role may take.
import { ArrowRight, BookMarked, Check, CheckCircle2, MessageSquare, Pencil, ScrollText, ShieldOff } from "lucide-react";
import { useState } from "react";
import { IssueChip, SeverityLabel } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatIsoDate } from "@/lib/format";
import type { IssueView } from "@/lib/services/drafts";
import { cn } from "@/lib/utils";

export type IssueAction = { action: "accept" } | { action: "edit"; text: string } | { action: "override"; reason: string } | { action: "comment"; body: string };

type Props = {
  issue: IssueView;
  active: boolean;
  busy: boolean;
  canFix: boolean; // creator/admin, and the text is not locked
  canOverride: boolean; // reviewer/admin
  onSelect: () => void;
  onAction: (action: IssueAction) => Promise<boolean>;
};

const STATE_NOTE: Record<string, string> = { accepted: "Fixed: suggestion accepted", edited: "Fixed: edited by the creator", overridden: "Overridden by the reviewer" };

export function IssueCard({ issue, active, busy, canFix, canOverride, onSelect, onAction }: Props) {
  const [mode, setMode] = useState<"idle" | "edit" | "override" | "comment">("idle");
  const [value, setValue] = useState("");
  const open = issue.state === "open";
  const wholeDraft = issue.spanStart === issue.spanEnd;
  const removal = issue.replacement === "";

  const start = (next: typeof mode, initial: string) => {
    setMode(next);
    setValue(initial);
  };
  const run = async (action: IssueAction) => {
    if (await onAction(action)) setMode("idle");
  };

  return (
    <article
      id={`issue-${issue.id}`}
      onClick={onSelect}
      className={cn("flex cursor-pointer flex-col gap-2 rounded-lg border bg-white p-3 text-sm transition-shadow", active ? "border-primary shadow-md ring-1 ring-primary" : "border-border hover:shadow-sm", !open && "bg-muted/40")}
    >
      <header className="flex items-center gap-2">
        <IssueChip kind={issue.kind} claimStatus={issue.claimStatus} />
        {open && <SeverityLabel severity={issue.severity} />}
        {!open && issue.state !== "resolved" && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-green-600" /> {STATE_NOTE[issue.state]}
          </span>
        )}
      </header>

      {/* excerpt → suggestion, e.g. ₹499 → ₹549 */}
      <p className="flex flex-wrap items-center gap-1.5 font-medium">
        <span className={cn("rounded bg-muted px-1.5 py-0.5", open && issue.replacement !== null && "line-through decoration-red-400")}>{issue.excerpt}</span>
        {issue.replacement !== null && issue.state !== "resolved" && (
          <>
            <ArrowRight className="size-3.5 text-muted-foreground" aria-label="suggested change" />
            <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-800">{removal ? "remove" : issue.replacement}</span>
          </>
        )}
        {issue.fact && <span className="text-xs font-normal text-muted-foreground">· {issue.fact.sourceName}</span>}
      </p>

      <p className="text-muted-foreground">{issue.explanation}</p>
      {open && <p>{issue.suggestion}</p>}

      {/* What exactly is cited: the fact version and/or the rule version. */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {issue.fact && (
          <span className="flex items-start gap-1.5">
            <BookMarked className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Fact Ledger: <strong className="font-medium text-foreground">{issue.fact.label}</strong> = {issue.fact.displayValue} · {issue.fact.sourceName} · version {issue.fact.versionNo}, effective {formatIsoDate(issue.fact.effectiveFrom)}
            </span>
          </span>
        )}
        {issue.rule && (
          <span className="flex items-start gap-1.5">
            <ScrollText className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Rule: <strong className="font-medium text-foreground">{issue.rule.title}</strong> · version {issue.rule.versionNo}
            </span>
          </span>
        )}
      </div>

      {open && mode === "idle" && (canFix || canOverride) && (
        <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          {canFix && issue.replacement !== null && !wholeDraft && (
            <Button size="sm" disabled={busy} onClick={() => run({ action: "accept" })}>
              <Check /> {removal ? "Accept: remove" : "Accept"}
            </Button>
          )}
          {canFix && !wholeDraft && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => start("edit", issue.replacement || issue.excerpt)}>
              <Pencil /> Edit
            </Button>
          )}
          {canOverride && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => start("override", "")}>
              <ShieldOff /> Override
            </Button>
          )}
          {canOverride && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => start("comment", "")}>
              <MessageSquare /> Comment
            </Button>
          )}
        </div>
      )}

      {mode === "edit" && (
        <form className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()} onSubmit={(e) => (e.preventDefault(), run({ action: "edit", text: value }))}>
          <label className="text-xs font-medium" htmlFor={`edit-${issue.id}`}>
            Replace “{issue.excerpt}” with:
          </label>
          <Input id={`edit-${issue.id}`} value={value} onChange={(e) => setValue(e.target.value)} autoFocus maxLength={500} />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy}>
              Apply edit
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === "override" && (
        <form className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()} onSubmit={(e) => (e.preventDefault(), run({ action: "override", reason: value }))}>
          <label className="text-xs font-medium" htmlFor={`override-${issue.id}`}>
            Why is this flag wrong here? (required, and logged for the Governance Brain)
          </label>
          <Textarea id={`override-${issue.id}`} value={value} onChange={(e) => setValue(e.target.value)} rows={2} autoFocus required minLength={3} maxLength={500} placeholder="e.g. 'yaar' fits our Instagram audience" />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy || value.trim().length < 3}>
              Override with this reason
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === "comment" && (
        <form className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()} onSubmit={(e) => (e.preventDefault(), run({ action: "comment", body: `Re “${issue.excerpt}”: ${value}` }))}>
          <label className="text-xs font-medium" htmlFor={`comment-${issue.id}`}>
            Comment for the creator
          </label>
          <Textarea id={`comment-${issue.id}`} value={value} onChange={(e) => setValue(e.target.value)} rows={2} autoFocus required maxLength={800} />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy || !value.trim()}>
              Post comment
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
