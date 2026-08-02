import PocketBase from "pocketbase";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export const pb = new PocketBase(env.PB_URL);
// This service is not a browser client - no request needs to be auto-cancelled
// because a newer one superseded it.
pb.autoCancellation(false);

async function authenticate(): Promise<void> {
  await pb.collection("_superusers").authWithPassword(
    env.PB_SUPERUSER_EMAIL,
    env.PB_SUPERUSER_PASSWORD,
  );
  logger.info("Authenticated as PocketBase superuser");
}

export async function ensureAdminAuth(): Promise<void> {
  if (pb.authStore.isValid) return;
  await authenticate();
}

/**
 * Runs `fn` with a valid admin session, transparently re-authenticating once
 * if the call fails with 401 (e.g. the superuser token expired mid-flight).
 */
export async function withAdminAuth<T>(fn: () => Promise<T>): Promise<T> {
  await ensureAdminAuth();
  try {
    return await fn();
  } catch (err) {
    if (isUnauthorized(err)) {
      logger.warn("PocketBase admin session expired, re-authenticating");
      await authenticate();
      return await fn();
    }
    throw err;
  }
}

function isUnauthorized(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status?: number }).status === 401
  );
}
