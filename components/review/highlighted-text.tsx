"use client";
// The draft text with an inline highlight for every issue. Spans can nest
// (a long sentence that contains a price), so the text is cut at every span
// boundary and each piece is coloured by the most specific issue covering it.
import { issueTone } from "@/components/badges";
import type { IssueView } from "@/lib/services/drafts";
import { cn } from "@/lib/utils";

type Props = { text: string; issues: IssueView[]; activeId: string | null; onSelect: (id: string) => void };

const isHandled = (issue: IssueView) => issue.state === "accepted" || issue.state === "edited" || issue.state === "overridden";

function highlightClass(issue: IssueView): string {
  if (isHandled(issue)) return "hl-done";
  return `hl-${issueTone(issue.kind, issue.claimStatus)}`;
}

export function HighlightedText({ text, issues, activeId, onSelect }: Props) {
  const spans = issues.filter((i) => i.spanEnd > i.spanStart && i.spanStart >= 0 && i.spanEnd <= text.length);
  const cuts = [...new Set([0, text.length, ...spans.flatMap((i) => [i.spanStart, i.spanEnd])])].sort((a, b) => a - b);

  const pieces = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const [start, end] = [cuts[k], cuts[k + 1]];
    const covering = spans.filter((i) => i.spanStart <= start && i.spanEnd >= end);
    // Most specific issue first: open before handled, then the shortest span.
    const top = covering.sort((a, b) => Number(isHandled(a)) - Number(isHandled(b)) || a.spanEnd - a.spanStart - (b.spanEnd - b.spanStart))[0];
    const piece = text.slice(start, end);
    if (!top) {
      pieces.push(<span key={start}>{piece}</span>);
      continue;
    }
    pieces.push(
      <mark
        key={start}
        role="button"
        tabIndex={0}
        aria-label={`${top.claimStatus ?? top.kind} issue: ${top.excerpt}`}
        title={top.explanation}
        onClick={() => onSelect(top.id)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(top.id))}
        className={cn("hl text-inherit", highlightClass(top), activeId === top.id && "hl-active")}
      >
        {piece}
      </mark>,
    );
  }
  return <p className="text-[17px] leading-9 whitespace-pre-wrap">{pieces}</p>;
}
