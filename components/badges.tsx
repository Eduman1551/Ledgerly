// Small coloured labels used across the app. Every badge has text (never colour
// alone), so the meaning does not depend on seeing colour.
import { Camera, FileText, Globe, Lock, Mail, Megaphone, ShieldAlert } from "lucide-react";
import type { Channel, ClaimStatus, DraftStatus, IssueKind, Language, Severity, Tier } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

const STATUS: Record<DraftStatus, { label: string; cls: string }> = {
  draft: { label: "Not checked", cls: "border-gray-200 bg-gray-50 text-gray-700" },
  checked: { label: "Checked", cls: "border-sky-200 bg-sky-50 text-sky-800" },
  in_review: { label: "In review", cls: "border-indigo-200 bg-indigo-50 text-indigo-800" },
  changes_requested: { label: "Changes requested", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  approved: { label: "Approved", cls: "border-green-200 bg-green-50 text-green-800" },
};

export function StatusBadge({ status }: { status: DraftStatus }) {
  return <span className={cn(base, STATUS[status].cls)}>{STATUS[status].label}</span>;
}

const TIER: Record<Tier, { label: string; cls: string; icon: typeof Globe; hint: string }> = {
  public: { label: "Public", cls: "border-gray-200 bg-white text-gray-700", icon: Globe, hint: "AI may read the text." },
  internal: { label: "Internal", cls: "border-amber-200 bg-amber-50 text-amber-800", icon: ShieldAlert, hint: "AI only sees redacted text." },
  confidential: { label: "Confidential", cls: "border-red-200 bg-red-50 text-red-800", icon: Lock, hint: "Never sent to AI. Checked locally." },
};

export function TierBadge({ tier }: { tier: Tier }) {
  const t = TIER[tier];
  return (
    <span className={cn(base, t.cls)} title={t.hint}>
      <t.icon className="size-3" /> {t.label}
    </span>
  );
}

const CHANNEL: Record<Channel, { label: string; icon: typeof Globe }> = {
  instagram: { label: "Instagram", icon: Camera },
  ad: { label: "Ad", icon: Megaphone },
  email: { label: "Email", icon: Mail },
  document: { label: "Document", icon: FileText },
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  const c = CHANNEL[channel];
  return (
    <span className={cn(base, "border-gray-200 bg-white text-gray-700")}>
      <c.icon className="size-3" /> {c.label}
    </span>
  );
}

const LANGUAGE_LABEL: Record<Language, string> = { english: "English", hindi: "Hindi", hinglish: "Hinglish", mixed: "Mixed script" };

export function LanguageBadge({ language }: { language: Language }) {
  return <span className={cn(base, "border-purple-200 bg-purple-50 text-purple-800")}>{LANGUAGE_LABEL[language]}</span>;
}

// --- Issue status chip --------------------------------------------------------

export type IssueTone = "supported" | "unsupported" | "outdated" | "conflicting" | "tone" | "term" | "other";

/** Which colour family an issue belongs to (also used for the inline highlight class). */
export function issueTone(kind: IssueKind, claimStatus: ClaimStatus | null): IssueTone {
  if (kind === "claim" && claimStatus) return claimStatus;
  if (kind === "tone") return "tone";
  if (kind === "term") return "term";
  return "other";
}

const CHIP: Record<IssueTone, string> = {
  supported: "border-green-200 bg-green-50 text-green-800",
  unsupported: "border-red-200 bg-red-50 text-red-800",
  outdated: "border-amber-200 bg-amber-50 text-amber-800",
  conflicting: "border-orange-200 bg-orange-50 text-orange-800",
  tone: "border-purple-200 bg-purple-50 text-purple-800",
  term: "border-red-200 bg-red-50 text-red-800",
  other: "border-blue-200 bg-blue-50 text-blue-800",
};

const KIND_LABEL: Record<IssueKind, string> = { claim: "Claim", term: "Terminology", tone: "Tone", language: "Language", accessibility: "Accessibility", visual: "Visual identity" };
const CLAIM_LABEL: Record<ClaimStatus, string> = { supported: "Supported", unsupported: "Unsupported", outdated: "Outdated", conflicting: "Conflicting" };

export function IssueChip({ kind, claimStatus }: { kind: IssueKind; claimStatus: ClaimStatus | null }) {
  const label = kind === "claim" && claimStatus ? CLAIM_LABEL[claimStatus] : KIND_LABEL[kind];
  return <span className={cn(base, CHIP[issueTone(kind, claimStatus)])}>{label}</span>;
}

const SEVERITY: Record<Severity, string> = { high: "text-red-700", medium: "text-amber-700", low: "text-gray-500" };

export function SeverityLabel({ severity }: { severity: Severity }) {
  return <span className={cn("text-[11px] font-medium uppercase tracking-wide", SEVERITY[severity])}>{severity}</span>;
}
