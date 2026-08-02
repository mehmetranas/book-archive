import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { requireAuth } from "../lib/auth.js";

export async function tmdbProxyRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: Record<string, string> }>(
    "/tmdb",
    { preHandler: requireAuth },
    async (request, reply) => {
      let path = request.query.path;
      if (!path) {
        return reply.code(400).send({ error: "Query param 'path' is required, e.g. ?path=/search/movie" });
      }
      if (!path.startsWith("/")) {
        path = `/${path}`;
      }

      const url = new URL(`https://api.themoviedb.org/3${path}`);
      url.searchParams.set("api_key", env.TMDB_API_KEY);
      for (const [key, value] of Object.entries(request.query)) {
        if (key === "path") continue;
        url.searchParams.set(key, value);
      }
      if (!url.searchParams.has("language")) {
        url.searchParams.set("language", "tr-TR");
      }

      const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (!res.ok) {
        return reply.code(res.status).send({ error: "TMDB upstream error", details: data });
      }
      return reply.send(data);
    },
  );
}
