// Tiny fetch helper for client components. Throws an Error with the server's
// message, so callers can show it in a toast.
export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown; formData?: FormData } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? (options.body || options.formData ? "POST" : "GET"),
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.formData ?? (options.body ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status})`);
  return data as T;
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");
