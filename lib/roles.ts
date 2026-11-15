// Which role sees what. Shared by the top bar (client) and the route guards
// (server), so navigation and access rules can never disagree.
import type { Role } from "@/lib/db/schema";

export const HOME_BY_ROLE: Record<Role, string> = { creator: "/creator", reviewer: "/reviewer", admin: "/admin" };

export const ROLE_LABEL: Record<Role, string> = { creator: "Creator", reviewer: "Reviewer", admin: "Admin / Brand owner" };

export type NavItem = { href: string; label: string; roles: Role[] };

/** Top-bar links. A page that is not listed for a role is guarded on the server too. */
export const NAV: NavItem[] = [
  { href: "/creator", label: "Dashboard", roles: ["creator"] },
  { href: "/reviewer", label: "Dashboard", roles: ["reviewer"] },
  { href: "/admin", label: "Dashboard", roles: ["admin"] },
  { href: "/drafts", label: "Drafts", roles: ["creator", "admin"] },
  { href: "/drafts", label: "Review queue", roles: ["reviewer"] },
  { href: "/ledger", label: "Fact Ledger", roles: ["creator", "reviewer", "admin"] },
  { href: "/guidelines", label: "Guidelines", roles: ["creator", "reviewer", "admin"] },
  { href: "/insights", label: "Insights", roles: ["admin"] },
  { href: "/admin/demo", label: "Demo tools", roles: ["admin"] },
];

/** Roles allowed on each guarded page. Pages not listed here are open to every role. */
export const PAGE_ROLES: Record<string, Role[]> = {
  "/creator": ["creator"],
  "/reviewer": ["reviewer"],
  "/admin": ["admin"],
  "/insights": ["admin"],
  "/admin/demo": ["admin"],
};
