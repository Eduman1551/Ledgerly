"use client";
// The three "Start as …" cards on the landing page. Clicking one sets the demo
// persona (a cookie, no password) and opens that role's first screen.
import { ArrowRight } from "lucide-react";
import type { Role } from "@/lib/db/schema";
import { HOME_BY_ROLE, useApp } from "./app-context";
import { Avatar } from "./top-bar";

const COPY: Record<Role, { title: string; does: string; first: string }> = {
  creator: { title: "Creator", does: "Writes posts, sees why something was flagged, accepts or edits fixes.", first: "Opens the drafts inbox" },
  reviewer: { title: "Reviewer / Manager", does: "Gives the final approval, or overrides a flag with a reason.", first: "Opens drafts waiting for review" },
  admin: { title: "Admin / Brand owner", does: "Owns the Fact Ledger and guidelines, reads the Governance Brain.", first: "Opens insights" },
};

export function PersonaCards() {
  const { personas, switchUser } = useApp();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {personas.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => switchUser(p.id, HOME_BY_ROLE[p.role])}
          className="group flex flex-col gap-3 rounded-xl border border-border bg-white p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="flex items-center gap-3">
            <Avatar name={p.name} role={p.role} className="size-10 text-sm" />
            <span>
              <span className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">{COPY[p.role].title}</span>
              <span className="block text-base font-semibold">Start as {p.name.split(" ")[0]}</span>
            </span>
          </span>
          <span className="text-sm text-muted-foreground">{COPY[p.role].does}</span>
          <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
            {COPY[p.role].first} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      ))}
    </div>
  );
}
