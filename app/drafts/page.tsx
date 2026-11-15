// Drafts inbox. Creators see everything they can work on; reviewers see what
// is waiting for them first.
import { Inbox } from "lucide-react";
import Link from "next/link";
import { ChannelBadge, LanguageBadge, StatusBadge, TierBadge } from "@/components/badges";
import { NewDraftDialog } from "@/components/drafts/new-draft-dialog";
import { EmptyState, PageHeader } from "@/components/form-fields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { listDrafts } from "@/lib/services/drafts";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listDrafts>>[number];

function DraftTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead>Draft</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Open issues</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">
                <Link href={`/drafts/${d.id}`} className="text-foreground underline-offset-4 hover:text-primary hover:underline">
                  {d.title}
                </Link>
                {d.language && d.language !== "english" && (
                  <span className="ml-2">
                    <LanguageBadge language={d.language} />
                  </span>
                )}
              </TableCell>
              <TableCell>
                <ChannelBadge channel={d.channel} />
              </TableCell>
              <TableCell>
                <TierBadge tier={d.tier} />
              </TableCell>
              <TableCell>
                <StatusBadge status={d.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {!d.checked ? <span className="text-muted-foreground">–</span> : d.openIssueCount === 0 ? <span className="text-green-700">0</span> : <span className="font-semibold text-red-700">{d.openIssueCount}</span>}
              </TableCell>
              <TableCell className="text-muted-foreground">{d.authorName}</TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(d.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function DraftsPage() {
  const [user, rows] = await Promise.all([getCurrentUser(), listDrafts(await getDb())]);
  const waiting = rows.filter((d) => d.status === "in_review");
  const isReviewer = user.role === "reviewer";

  return (
    <div>
      <PageHeader
        title={isReviewer ? "Review queue" : "Drafts"}
        description={isReviewer ? "Drafts sent for your approval come first. You can approve, request changes, or override a flag with a reason." : "Open a draft to see what Ledgerly flagged, why, and the suggested fix. You decide what to accept."}
        actions={user.role !== "reviewer" ? <NewDraftDialog /> : undefined}
      />
      {rows.length === 0 ? (
        <EmptyState title="No drafts yet" icon={<Inbox className="size-6 text-muted-foreground" />}>
          Create a draft to see it checked, or load the demo data from Demo tools.
        </EmptyState>
      ) : isReviewer ? (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Waiting for your review ({waiting.length})</h2>
            {waiting.length ? <DraftTable rows={waiting} /> : <EmptyState title="Nothing is waiting for review">When a creator sends a draft to the reviewer it appears here.</EmptyState>}
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">All other drafts</h2>
            <DraftTable rows={rows.filter((d) => d.status !== "in_review")} />
          </section>
        </div>
      ) : (
        <DraftTable rows={rows} />
      )}
    </div>
  );
}
