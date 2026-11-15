// Route guard: if the current persona's role may not use a page, show a
// friendly card with a one-click role switch instead of an error.
import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import type { Role } from "@/lib/db/schema";
import { HOME_BY_ROLE, PAGE_ROLES, ROLE_LABEL } from "@/lib/roles";
import { SEED_USERS } from "@/lib/seed/data";
import { getCurrentUser } from "@/lib/session";
import { SwitchRoleButtons } from "./switch-role-buttons";

const WHY: Record<string, string> = {
  "/creator": "This is the creator's dashboard: their drafts and the fixes still to make.",
  "/reviewer": "This is the reviewer's dashboard: drafts waiting for a final decision.",
  "/admin": "This is the brand owner's dashboard: ledger, guidelines and Governance Brain.",
  "/insights": "The Governance Brain is for the brand owner, who decides whether a guideline gets rewritten.",
  "/admin/demo": "Demo tools (reset data, health check) live with the brand owner.",
};

/** True when `role` may open `path` (see PAGE_ROLES in lib/roles.ts). */
export function canOpen(path: string, role: Role): boolean {
  const allowed = PAGE_ROLES[path];
  return !allowed || allowed.includes(role);
}

export async function RoleGate({ path, children }: { path: string; children: ReactNode }) {
  const user = await getCurrentUser();
  if (canOpen(path, user.role)) return <>{children}</>;

  const allowed = PAGE_ROLES[path] ?? [];
  const personas = SEED_USERS.filter((u) => allowed.includes(u.role)).map((u) => ({ id: u.id, label: `Switch to ${u.name} (${ROLE_LABEL[u.role]})` }));
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-border bg-white px-6 py-12 text-center shadow-sm">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted">
        <LockKeyhole className="size-5 text-muted-foreground" />
      </span>
      <h1 className="text-xl font-semibold">This page is for another role</h1>
      <p className="text-sm text-muted-foreground">
        {WHY[path] ?? "This page belongs to another role."} You are using Ledgerly as <strong className="text-foreground">{user.name}</strong> ({ROLE_LABEL[user.role]}).
      </p>
      <SwitchRoleButtons personas={personas} stayOn={path} myHome={HOME_BY_ROLE[user.role]} />
    </div>
  );
}
