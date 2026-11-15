// Applying a fix to the draft text, and keeping the other issues' highlight
// positions in sync with the new text.

export type AppliedFix = { text: string; start: number; end: number; removedStart: number; removedEnd: number };

/**
 * Replace text[start, end) with `replacement`.
 * When the replacement is empty (a removal) we also drop one neighbouring
 * space so the sentence does not end up with a double space.
 */
export function applyReplacement(text: string, start: number, end: number, replacement: string): AppliedFix {
  let from = Math.max(0, Math.min(start, text.length));
  let to = Math.max(from, Math.min(end, text.length));
  if (replacement === "") {
    const before = text[from - 1];
    const after = text[to];
    if (before === " " && (after === undefined || /[\s.,!?;:।]/.test(after))) from -= 1;
    else if (after === " " && (before === undefined || before === " " || before === "\n")) to += 1;
    else if (before === " " && after === " ") from -= 1;
  }
  return {
    text: text.slice(0, from) + replacement + text.slice(to),
    start: from,
    end: from + replacement.length,
    removedStart: from,
    removedEnd: to,
  };
}

/** Move another issue's span so it still points at the same words after a fix. */
export function shiftSpan(span: { start: number; end: number }, fix: AppliedFix): { start: number; end: number } {
  const delta = fix.end - fix.start - (fix.removedEnd - fix.removedStart);
  if (span.end <= fix.removedStart) return span; // entirely before the fix
  if (span.start >= fix.removedEnd) return { start: span.start + delta, end: span.end + delta }; // entirely after
  if (span.start <= fix.removedStart && span.end >= fix.removedEnd) return { start: span.start, end: span.end + delta }; // contains the fix
  // Partly overlapping: collapse onto the replaced text.
  return { start: fix.start, end: fix.end };
}
