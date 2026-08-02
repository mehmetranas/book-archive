import { pb } from "./pocketbase-admin-client.js";

/**
 * Builds a PocketBase filter expression with parameter placeholders instead
 * of raw string interpolation - use this for every filter built from
 * user-controlled input (search terms, titles, isbns, etc).
 *
 * Thin wrapper around the SDK's own `pb.filter()` so call sites don't need
 * to import the admin client instance just to reach it.
 */
export function buildFilter(raw: string, params?: Record<string, unknown>): string {
  return pb.filter(raw, params);
}
