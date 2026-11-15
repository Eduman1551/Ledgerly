// Creator dashboard (Riya): my drafts, what still needs fixing, quick stats.
import { BadgeCheck, CircleAlert, FileCheck2, Wrench } from "lucide-react";
import { DashboardHeader, DraftRows, Panel, StatTile } from "@/components/dashboard/parts";
import { NewDraftDialog } from "@/components/drafts/new-draft-dialog";
import { RoleGate } from "@/components/role-gate";
import { getDb } from "@/lib/db";
import { getCreatorDashboard } from "@/lib/services/dashboard";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function CreatorDashboard() {
  const user = await getCurrentUser();
  const { drafts, stats } = await getCreatorDashboard(await getDb(), user.id);
  const todo = drafts.filter((d) => d.status === "changes_requested" || (d.status !== "approved" && d.status !== "in_review" && (d.openIssueCount > 0 || !d.checked)));
  const rest = drafts.filter((d) => !todo.includes(d));

  return (
    <div>
      <DashboardHeader greeting={`Namaste, ${user.name.split(" ")[0]}`} role="Creator">
        <NewDraftDialog />
      </DashboardHeader>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Your numbers">
        <StatTile icon={FileCheck2} label="Drafts checked" value={`${stats.checked} / ${stats.total}`} hint="every claim matched to the ledger" />
        <StatTile icon={Wrench} label="Issues fixed" value={stats.issuesFixed} hint="fixes you accepted or edited" tone="green" />
        <StatTile icon={CircleAlert} label="Open issues" value={stats.openIssues} hint={`across ${stats.needsWork} draft${stats.needsWork === 1 ? "" : "s"} that need work`} tone="amber" />
        <StatTile icon={BadgeCheck} label="Approved" value={stats.approved} hint="ready to publish" tone="purple" />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel title={`Needs your attention (${todo.length})`}>
          <DraftRows drafts={todo} empty="Nothing to fix. Write a new draft to get it checked." cta="Fix" />
        </Panel>
        <Panel title="In review and done">
          <DraftRows drafts={rest} empty="Drafts you send to the reviewer show up here." />
        </Panel>
      </div>
    </div>
  );
}

export default function CreatorPage() {
  return (
    <RoleGate path="/creator">
      <CreatorDashboard />
    </RoleGate>
  );
}
