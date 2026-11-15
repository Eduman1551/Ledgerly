// Date formatting with a fixed locale and time zone (IST), so the server and
// the browser always render the same text.
const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const dateOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export const formatDateTime = (value: Date | string) => dateTime.format(new Date(value));
export const formatDate = (value: Date | string) => dateOnly.format(new Date(value));

/** "2026-11-01" → "1 Nov 2026" */
export const formatIsoDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? dateOnly.format(new Date(`${iso}T12:00:00+05:30`)) : iso);

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
