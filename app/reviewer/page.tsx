// Reviewer dashboard (Arjun): the review queue, recent approvals, my overrides.
import { BadgeCheck, Hourglass, ShieldOff, Undo2 } from "lucide-react";
import Link from "next/link";
import { ChannelBadge } from "@/components/badges";
import { DashboardHeader, DraftRows, Panel, StatTile } from "@/components/dashboard/parts";
import { RoleGate } from "@/components/role-gate";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getReviewerDashboard } from "@/lib/services/dashboard";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function ReviewerDashboard() {
  const user = await getCurrentUser();
  const { queue, recentlyApproved, stats } = await getReviewerDashboard(await getDb(), user.id);

  return (
    <div>
      <DashboardHeader greeting={`Hello, ${user.name.split(" ")[0]}`} role="Reviewer" />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Your numbers">
        <StatTile icon={Hourglass} label="Waiting for you" value={stats.waiting} hint="drafts sent for final approval" tone="amber" />
        <StatTile icon={BadgeCheck} label="Approved by you" value={stats.approved} tone="green" />
        <StatTile icon={ShieldOff} label="Flags overridden" value={stats.overrides} hint="each with a logged reason" tone="purple" />
        <StatTile icon={Undo2} label="Changes requested" value={stats.changesRequested} tone="slate" />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[3fr_2fr]">
        <Panel title={`Review queue (${queue.length})`} action={<Link href="/drafts" className="text-sm font-medium text-primary hover:underline">All drafts</Link>}>
          <DraftRows drafts={queue} empty="Nothing is waiting for review. When a creator sends a draft, it appears here." cta="Review" />
          <p className="text-xs text-muted-foreground">Open a draft to override a flag with a reason, then approve or request changes. Ledgerly never publishes.</p>
        </Panel>
        <Panel title="Recently approved">
          {recentlyApproved.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approvals yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentlyApproved.map((d) => (
                <li key={d.id}>
                  <Link href={`/drafts/${d.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted">
                    <BadgeCheck className="size-4 shrink-0 text-green-600" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span>
                    <ChannelBadge channel={d.channel} />
                    <span className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(d.approvedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default function ReviewerPage() {
  return (
    <RoleGate path="/reviewer">
      <ReviewerDashboard />
    </RoleGate>
  );
}
