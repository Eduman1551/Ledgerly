"use client";
// The three role cards on the home page. Clicking one sets the demo persona
// (a cookie, no password) and opens that role's dashboard.
import { ArrowRight, Check, ClipboardCheck, PenLine, ShieldCheck, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/db/schema";
import { HOME_BY_ROLE } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useApp } from "./app-context";
import { Avatar } from "./top-bar";

const CARDS: Record<Role, { title: string; icon: LucideIcon; does: string; points: string[]; accent: string; ring: string }> = {
  creator: {
    title: "Creator",
    icon: PenLine,
    does: "Writes posts and fixes what Ledgerly flags, in plain language.",
    points: ["See why each line was flagged", "Accept or edit suggested fixes", "Send to the reviewer"],
    accent: "from-teal-500/15",
    ring: "group-hover:ring-teal-600/30",
  },
  reviewer: {
    title: "Reviewer",
    icon: ClipboardCheck,
    does: "Makes the final call: approve, or override a flag with a reason.",
    points: ["Only real issues, each with a source", "Override with a logged reason", "Approve or request changes"],
    accent: "from-indigo-500/15",
    ring: "group-hover:ring-indigo-600/30",
  },
  admin: {
    title: "Admin / Brand owner",
    icon: ShieldCheck,
    does: "Owns the Fact Ledger and guidelines, and reads what the Brain learned.",
    points: ["Version facts and rules", "Spot vague rules from overrides", "Accept guideline rewrites"],
    accent: "from-amber-500/15",
    ring: "group-hover:ring-amber-600/30",
  },
};

export function PersonaCards() {
  const { personas, switchUser } = useApp();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {personas.map((p) => {
        const card = CARDS[p.role];
        const first = p.name.split(" ")[0];
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => switchUser(p.id, HOME_BY_ROLE[p.role])}
            className={cn(
              "group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-white p-6 text-left shadow-[0_1px_3px_rgba(16,24,40,0.06)] ring-1 ring-transparent transition duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              card.ring,
            )}
          >
            <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", card.accent)} />
            <span className="relative flex items-center gap-3">
              <Avatar name={p.name} role={p.role} className="size-12 text-base shadow-sm" />
              <span>
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <card.icon className="size-3.5" /> {card.title}
                </span>
                <span className="block text-lg font-semibold">{p.name}</span>
              </span>
            </span>
            <span className="relative text-sm text-muted-foreground">{card.does}</span>
            <ul className="relative flex flex-col gap-1.5 text-sm">
              {card.points.map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <Check className="size-3.5 text-primary" /> {point}
                </li>
              ))}
            </ul>
            <span className="relative mt-auto flex items-center justify-between rounded-xl bg-[#1f2933] px-4 py-2.5 text-sm font-medium text-white transition-colors group-hover:bg-primary">
              Enter as {first}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
