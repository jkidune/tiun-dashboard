import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { ApiKey, Prisma } from "@/lib/generated/prisma";
import { db } from "./db";
import { hashApiKey } from "./keys";

type Handler = (ctx: { key: ApiKey; body: unknown }) => Promise<{ status: number; body: Record<string, unknown> }>;

const error = (status: number, message: string) => ({ status, body: { error: { status, message } } });

/**
 * Authenticates a public API request with `Authorization: Bearer sk_…`,
 * checks the scope, runs the handler and logs the call to ApiRequest.
 */
export async function withApiKey(req: NextRequest, scope: string, handler: Handler) {
  const started = Date.now();
  const raw = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const key = raw ? await db.apiKey.findUnique({ where: { keyHash: hashApiKey(raw) } }) : null;

  let body: unknown = undefined;
  if (req.method !== "GET") {
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }
  }

  let result: { status: number; body: Record<string, unknown> };
  if (!key) result = error(401, "Missing or invalid API key. Send it as: Authorization: Bearer sk_live_…");
  else if (key.revokedAt) result = error(401, "This API key was revoked.");
  else if (key.expiresAt && key.expiresAt < new Date()) result = error(401, "This API key has expired.");
  else if (!key.scopes.includes(scope)) result = error(403, `This key is missing the ${scope} permission.`);
  else {
    try {
      result = await handler({ key, body });
    } catch (e) {
      console.error(e);
      result = error(500, "Internal error. Try again.");
    }
  }

  // Only log calls we can attribute to a workspace.
  if (key) {
    await db.$transaction([
      db.apiRequest.create({
        data: {
          workspaceId: key.workspaceId,
          mode: key.mode,
          apiKeyId: key.id,
          method: req.method,
          path: new URL(req.url).pathname.replace(/^\/api/, ""),
          statusCode: result.status,
          latencyMs: Date.now() - started,
          requestBody: (body ?? undefined) as Prisma.InputJsonValue | undefined,
          responseBody: result.body as Prisma.InputJsonObject,
        },
      }),
      db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }),
    ]);
  }
  return NextResponse.json(result.body, { status: result.status });
}

export const apiError = error;
