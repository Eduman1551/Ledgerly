// Picks the AI adapter for one API request: none when the user turned AI off or
// no key is set, and a "blocked" adapter when the visitor is over the rate limit.
import type { AiAdapter } from "@/lib/engine/types";
import { getAiAdapter } from "./analyze";
import { allowAiCall, clientKey } from "./rate-limit";

export function aiForRequest(request: Request, useAi: boolean): AiAdapter | null {
  if (!useAi) return null;
  const adapter = getAiAdapter();
  if (!adapter) return null;
  if (allowAiCall(clientKey(request))) return adapter;
  // Over the limit: nothing is sent; the engine falls back to local rules.
  return {
    model: adapter.model,
    analyze: () => Promise.reject(Object.assign(new Error("AI rate limit reached"), { notSent: true })),
  };
}
