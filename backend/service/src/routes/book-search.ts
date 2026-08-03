import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { requireAuth } from "../lib/auth.js";

interface GoogleBooksVolume {
  id: string;
  volumeInfo: unknown;
}

interface GoogleBooksResponse {
  items?: GoogleBooksVolume[];
}

export async function bookSearchRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { q?: string } }>(
    "/book-search",
    { preHandler: requireAuth },
    async (request, reply) => {
      const query = request.query.q;
      if (!query) {
        return reply.code(400).send({ error: "Query param 'q' is required" });
      }

      const url = new URL("https://www.googleapis.com/books/v1/volumes");
      url.searchParams.set("q", query);
      url.searchParams.set("maxResults", "20");
      url.searchParams.set("printType", "books");
      url.searchParams.set("country", "TR");
      url.searchParams.set("key", env.GOOGLE_BOOKS_KEY);

      const res = await fetch(url);
      if (!res.ok) {
        const details = await res.text();
        return reply.code(res.status).send({ error: "Google Books API error", details });
      }

      const data = (await res.json()) as GoogleBooksResponse;
      return reply.send(data.items ?? []);
    },
  );
}
