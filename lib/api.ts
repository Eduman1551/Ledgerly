// Helpers shared by every REST route handler: JSON errors, Zod validation and
// role checks. A route never throws to the client; it always answers with JSON.
import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import type { Role } from "@/lib/db/schema";
import { ServiceError, forbidden } from "@/lib/services/errors";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

export const jsonError = (status: number, error: string, details?: unknown) => NextResponse.json({ error, details }, { status });

/** Wrap a handler so every failure becomes a clean JSON error. */
export function route<Ctx>(handler: (request: Request, context: Ctx) => Promise<unknown>) {
  return async (request: Request, context: Ctx) => {
    try {
      const result = await handler(request, context);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof ServiceError) return jsonError(error.status, error.message);
      if (error instanceof ZodError) {
        const first = error.issues[0];
        return jsonError(400, first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input", error.issues);
      }
      console.error("[api]", error);
      return jsonError(500, "Something went wrong on the server. Please try again.");
    }
  };
}

/** Parse and validate a JSON body. An empty body is treated as {}. */
export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown = {};
  try {
    const text = await request.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ServiceError(400, "The request body is not valid JSON.");
  }
  return schema.parse(raw);
}

/** The current persona, if their role is allowed to do this. */
export async function requireRole(...allowed: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!allowed.includes(user.role)) {
    throw forbidden(`Only ${allowed.join(" or ")} can do this. Switch persona in the top bar (you are ${user.name}, ${user.role}).`);
  }
  return user;
}

export type IdParams = { params: Promise<{ id: string }> };
