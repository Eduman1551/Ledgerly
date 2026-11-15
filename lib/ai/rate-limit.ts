// Simple in-memory rate limit for the AI-calling routes. All judges share one
// free-tier key, so each visitor gets a small budget per minute. (Per server
// instance; good enough for a demo, not a replacement for a real limiter.)
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** True when this client may make another AI call now. */
export function allowAiCall(key: string, limit = 8): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return true;
}
