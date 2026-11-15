"use client";
// Top bar: logo, navigation for the current role, AI status pill, role switcher.
import { BookOpenCheck, ChevronDown, Cpu, CpuIcon, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Role } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { HOME_BY_ROLE, useApp } from "./app-context";

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: "/drafts", label: "Drafts", roles: ["creator", "reviewer", "admin"] },
  { href: "/ledger", label: "Fact Ledger", roles: ["creator", "reviewer", "admin"] },
  { href: "/guidelines", label: "Guidelines", roles: ["creator", "reviewer", "admin"] },
  { href: "/insights", label: "Insights", roles: ["reviewer", "admin"] },
  { href: "/admin/demo", label: "Demo tools", roles: ["creator", "reviewer", "admin"] },
];

const ROLE_LABEL: Record<Role, string> = { creator: "Creator", reviewer: "Reviewer", admin: "Admin / Brand owner" };
const ROLE_COLOR: Record<Role, string> = { creator: "bg-teal-700", reviewer: "bg-indigo-600", admin: "bg-amber-700" };

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

export function Avatar({ name, role, className }: { name: string; role: Role; className?: string }) {
  return <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white", ROLE_COLOR[role], className)}>{initials(name)}</span>;
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BookOpenCheck className="size-4.5" />
      </span>
      Ledgerly
    </span>
  );
}

function AiPill() {
  const { aiConfigured, aiEnabled, setAiEnabled, aiModel } = useApp();
  if (!aiConfigured) {
    return (
      <span title="No AI key is configured on the server. Every check runs with local rules." className="hidden items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground md:inline-flex">
        <ShieldCheck className="size-3.5" /> AI: off (local fallback)
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setAiEnabled(!aiEnabled)}
      title={aiEnabled ? `AI is on (${aiModel}). Click to switch to local rules only.` : "AI is off. Checks use local rules only. Click to switch AI on."}
      aria-pressed={aiEnabled}
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors md:inline-flex",
        aiEnabled ? "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100" : "border-border bg-muted text-muted-foreground hover:bg-gray-200",
      )}
    >
      {aiEnabled ? <Cpu className="size-3.5" /> : <CpuIcon className="size-3.5 opacity-50" />}
      {aiEnabled ? "AI: on" : "AI: off (local fallback)"}
    </button>
  );
}

function RoleSwitcher() {
  const { user, personas, switchUser } = useApp();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border bg-white py-1 pr-2 pl-1 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" aria-label="Switch demo persona">
        <Avatar name={user.name} role={user.role} />
        <span className="hidden leading-tight sm:block">
          <span className="block text-xs font-medium">{user.name}</span>
          <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch demo persona (no sign-in)</DropdownMenuLabel>
          {personas.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => switchUser(p.id, HOME_BY_ROLE[p.role])} className="gap-2">
              <Avatar name={p.name} role={p.role} />
              <span className="leading-tight">
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{ROLE_LABEL[p.role]}</span>
              </span>
              {p.id === user.id && <span className="ml-auto text-xs text-primary">current</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const { user } = useApp();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" aria-label="Ledgerly home">
          <Logo />
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto" aria-label="Main">
          {NAV.filter((n) => n.roles.includes(user.role)).map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link key={n.href} href={n.href} className={cn("rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors", active ? "bg-teal-50 text-teal-800" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <AiPill />
        <RoleSwitcher />
      </div>
    </header>
  );
}
