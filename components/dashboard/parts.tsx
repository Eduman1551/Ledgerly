// Building blocks shared by the three role dashboards.
import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChannelBadge, StatusBadge, TierBadge } from "@/components/badges";
import type { DraftStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export function DashboardHeader({ greeting, role, children }: { greeting: string; role: string; children?: ReactNode }) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-teal-50 via-white to-white p-6">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">{role} dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{greeting}</h1>
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}

export function StatTile({ icon: Icon, label, value, hint, tone = "teal" }: { icon: LucideIcon; label: string; value: ReactNode; hint?: string; tone?: "teal" | "amber" | "purple" | "green" | "slate" }) {
  const tones = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-purple-50 text-purple-700",
    green: "bg-green-50 text-green-700",
    slate: "bg-gray-100 text-gray-700",
  };
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border border-border bg-white p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

type DraftRowData = { id: string; title: string; status: DraftStatus; channel: "instagram" | "ad" | "email" | "document"; tier: "public" | "internal" | "confidential"; openIssueCount: number; checked: boolean };

export function DraftRows({ drafts, empty, cta = "Open" }: { drafts: DraftRowData[]; empty: string; cta?: string }) {
  if (drafts.length === 0) return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {drafts.map((d) => (
        <li key={d.id}>
          <Link href={`/drafts/${d.id}`} className="group flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted">
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="truncate font-medium group-hover:text-primary">{d.title}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <ChannelBadge channel={d.channel} />
                <TierBadge tier={d.tier} />
                <StatusBadge status={d.status} />
              </span>
            </span>
            <span className="text-right text-sm whitespace-nowrap tabular-nums">
              {!d.checked ? <span className="text-muted-foreground">not checked</span> : d.openIssueCount === 0 ? <span className="text-green-700">0 open</span> : <span className="font-semibold text-red-700">{d.openIssueCount} open</span>}
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-primary">
              {cta} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function QuickLink({ href, icon: Icon, title, text }: { href: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <Link href={href} className="group flex items-start gap-3 rounded-xl border border-border bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-medium group-hover:text-primary">
          {title} <ArrowRight className="size-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
        </span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </Link>
  );
}
