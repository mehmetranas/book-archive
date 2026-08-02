import Fastify from "fastify";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { ensureAdminAuth } from "./lib/pocketbase-admin-client.js";
import { bookSearchRoute } from "./routes/book-search.js";
import { spotifySearchRoute } from "./routes/spotify-search.js";
import { tmdbProxyRoute } from "./routes/tmdb-proxy.js";
import { booksRoute } from "./routes/books.js";
import { startPollLoop } from "./workers/poll-loop.js";
import { sweepStaleJobs } from "./workers/sweep.js";

const SWEEP_INTERVAL_MS = 90_000;

async function main(): Promise<void> {
  await ensureAdminAuth();

  const app = Fastify({ loggerInstance: logger });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(bookSearchRoute);
  await app.register(spotifySearchRoute);
  await app.register(tmdbProxyRoute);
  await app.register(booksRoute);

  startPollLoop("stale-job-sweep", SWEEP_INTERVAL_MS, sweepStaleJobs);

  await app.listen({ host: "0.0.0.0", port: env.PORT });
}

main().catch((err) => {
  logger.error({ err }, "Fatal error during startup");
  process.exit(1);
});
