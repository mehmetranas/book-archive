import PocketBase, { type RecordModel } from "pocketbase";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: RecordModel;
  }
}

export class AuthError extends Error {}

/**
 * Validates a PocketBase-issued user bearer token by asking PocketBase itself
 * to refresh it. Avoids reimplementing JWT verification/secret handling here.
 */
export async function verifyUserToken(token: string): Promise<RecordModel> {
  const client = new PocketBase(env.PB_URL);
  client.autoCancellation(false);
  client.authStore.save(token, null);
  try {
    const { record } = await client.collection("users").authRefresh();
    return record;
  } catch {
    throw new AuthError("Invalid or expired token");
  }
}

function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/** Fastify preHandler: rejects the request with 401 if no valid user token is present. */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = extractBearerToken(request);
  if (!token) {
    await reply.code(401).send({ error: "Missing Authorization header" });
    return;
  }
  try {
    request.user = await verifyUserToken(token);
  } catch {
    await reply.code(401).send({ error: "Invalid or expired token" });
  }
}

/** Fastify preHandler: attaches request.user if a valid token is present, but never rejects. */
export async function optionalAuth(request: FastifyRequest): Promise<void> {
  const token = extractBearerToken(request);
  if (!token) return;
  try {
    request.user = await verifyUserToken(token);
  } catch {
    // Invalid/expired token on an optional-auth route - proceed unauthenticated.
  }
}
