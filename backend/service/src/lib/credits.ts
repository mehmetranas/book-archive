import { pb, withAdminAuth } from "./pocketbase-admin-client.js";
import { logger } from "./logger.js";

/**
 * Serializes credit mutations in-process. PocketBase's REST API has no
 * compare-and-swap primitive, so this only provides atomicity as long as
 * this service runs as a single container - do not horizontally scale
 * without replacing this with a DB/Redis-based lock.
 */
let chain: Promise<unknown> = Promise.resolve();

function withCreditsLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = chain.then(fn, fn);
  // Swallow rejections in the chain itself so one failed deduction doesn't
  // permanently wedge the queue for subsequent callers.
  chain = result.catch(() => undefined);
  return result;
}

async function getEnrichmentCost(): Promise<number> {
  try {
    const setting = await withAdminAuth(() =>
      pb.collection("system_settings").getFirstListItem(pb.filter("created != {:empty}", { empty: "" })),
    );
    const pricing = setting.ai_pricing as { enrichment_cost?: unknown } | undefined;
    const cost = Number(pricing?.enrichment_cost);
    return Number.isFinite(cost) ? cost : 0;
  } catch (err) {
    logger.warn({ err }, "[credits] Could not read ai_pricing, treating enrichment as free");
    return 0;
  }
}

/**
 * Deducts the configured enrichment cost from a book's owner, floored at 0.
 * Never throws - a pricing/credit failure should not block enrichment from
 * completing, matching the original hook's behavior.
 */
export async function chargeEnrichmentCost(userId: string): Promise<void> {
  await withCreditsLock(async () => {
    const cost = await getEnrichmentCost();
    if (cost <= 0) return;

    try {
      const user = await withAdminAuth(() => pb.collection("users").getOne(userId));
      const current = Number(user.credits) || 0;
      const next = Math.max(0, current - cost);
      await withAdminAuth(() => pb.collection("users").update(userId, { credits: next }));
      logger.info({ userId, cost, next }, "[credits] Charged enrichment cost");
    } catch (err) {
      logger.warn({ err, userId }, "[credits] Failed to charge enrichment cost");
    }
  });
}
