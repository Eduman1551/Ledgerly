"use client";
// Below the draft: revision history with diffs, the decision log, and comments.
import { useState } from "react";
import { Avatar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Role } from "@/lib/db/schema";
import { diffWords } from "@/lib/diff";
import { formatDateTime } from "@/lib/format";
import { SEED_USERS } from "@/lib/seed/data";
import type { getDraftDetail } from "@/lib/services/drafts";
import { cn } from "@/lib/utils";

type Detail = Awaited<ReturnType<typeof getDraftDetail>>;

const roleOf = (userId: string | null): Role => SEED_USERS.find((u) => u.id === userId)?.role ?? "creator";

const ACTION_LABEL: Record<string, { label: string; cls: string }> = {
  accept: { label: "accepted the fix for", cls: "text-green-700" },
  edit: { label: "edited", cls: "text-green-700" },
  override: { label: "overrode the flag on", cls: "text-purple-700" },
  approve: { label: "approved the draft", cls: "text-green-700" },
  request_changes: { label: "requested changes", cls: "text-amber-700" },
};

function Diff({ before, after }: { before: string; after: string }) {
  return (
    <p className="rounded-md bg-muted/60 p-2 text-sm leading-7 whitespace-pre-wrap">
      {diffWords(before, after).map((part, i) =>
        part.type === "same" ? (
          <span key={i}>{part.text}</span>
        ) : part.type === "added" ? (
          <ins key={i} className="rounded bg-green-100 text-green-900 no-underline">
            {part.text}
          </ins>
        ) : (
          <del key={i} className="rounded bg-red-100 text-red-900">
            {part.text}
          </del>
        ),
      )}
    </p>
  );
}

export function HistoryTabs({ detail, onComment, busy }: { detail: Detail; onComment: (body: string) => Promise<boolean>; busy: boolean }) {
  const [comment, setComment] = useState("");
  const revisions = [...detail.revisions].reverse();

  return (
    <Tabs defaultValue="revisions">
      <TabsList>
        <TabsTrigger value="revisions">Revision history ({detail.revisions.length})</TabsTrigger>
        <TabsTrigger value="decisions">Decision log ({detail.decisions.length})</TabsTrigger>
        <TabsTrigger value="comments">Comments ({detail.comments.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="revisions" className="flex flex-col gap-3 pt-2">
        {revisions.map((rev) => {
          const previous = detail.revisions.find((r) => r.revisionNo === rev.revisionNo - 1);
          return (
            <div key={rev.id} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">Revision {rev.revisionNo}</span>
                <span className="font-medium">{rev.note ?? "Edited"}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {rev.createdByName} · {formatDateTime(rev.createdAt)}
                </span>
              </div>
              {previous ? <Diff before={previous.text} after={rev.text} /> : <p className="rounded-md bg-muted/60 p-2 text-sm leading-7 whitespace-pre-wrap">{rev.text}</p>}
            </div>
          );
        })}
      </TabsContent>

      <TabsContent value="decisions" className="pt-2">
        {detail.decisions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No decisions yet. Every accept, edit, override and approval is logged here and feeds the Governance Brain.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {detail.decisions.map((d) => (
              <li key={d.id} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                <Avatar name={d.actorName} role={roleOf(d.actorId)} className="size-6 text-[10px]" />
                <div className="flex-1">
                  <p>
                    <span className="font-medium">{d.actorName}</span> <span className={cn("font-medium", ACTION_LABEL[d.action]?.cls)}>{ACTION_LABEL[d.action]?.label ?? d.action}</span>
                    {d.excerpt && <span> “{d.excerpt}”</span>}
                    {d.ruleTitle && <span className="text-muted-foreground"> · {d.ruleTitle}</span>}
                  </p>
                  {d.reason && <p className="mt-0.5 text-muted-foreground">Reason: {d.reason}</p>}
                </div>
                <span className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(d.createdAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </TabsContent>

      <TabsContent value="comments" className="flex flex-col gap-3 pt-2">
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onComment(comment)) setComment("");
          }}
        >
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Add a comment…" aria-label="Add a comment" maxLength={1000} />
          <Button type="submit" size="sm" variant="outline" className="w-fit" disabled={busy || !comment.trim()}>
            Post comment
          </Button>
        </form>
        {detail.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
        {detail.comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
            <Avatar name={c.authorName} role={roleOf(c.authorId)} className="size-6 text-[10px]" />
            <div className="flex-1">
              <p className="font-medium">{c.authorName}</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{c.body}</p>
            </div>
            <span className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(c.createdAt)}</span>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}
