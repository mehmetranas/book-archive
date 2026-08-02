import { logger } from "../lib/logger.js";

/**
 * Self-rescheduling loop: runs `fn`, waits for it to settle, then schedules
 * the next tick via `setTimeout` - never a raw `setInterval`, so a slow tick
 * can never overlap itself.
 */
export function startPollLoop(name: string, intervalMs: number, fn: () => Promise<void>): void {
  async function tick(): Promise<void> {
    try {
      await fn();
    } catch (err) {
      logger.error({ err, loop: name }, "[poll-loop] Tick failed");
    }
    setTimeout(tick, intervalMs);
  }

  setTimeout(tick, intervalMs);
}
