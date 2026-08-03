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

// Google Books' default `q` does a full-text search across description/content,
// which buries the actual title match under unrelated books that merely mention
// the term (e.g. "körlük" surfaces academic essays before Saramago's novel).
// `intitle:"..."` restricts to title matches, which is what a book-search box
// actually means. Leave already-qualified queries (isbn:, inauthor:, from a
// barcode scan or an "search by this author" tap) untouched.
const FIELD_OPERATOR = /\b(isbn|inauthor|intitle|insubject|inpublisher):/i;

function buildSearchQuery(query: string): string {
  if (FIELD_OPERATOR.test(query)) return query;
  return `intitle:"${query}"`;
}

async function fetchWithRetry(url: URL, attempts = 3): Promise<Response> {
  let lastRes: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url);
    if (res.status !== 503) return res;
    lastRes = res;
    await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
  }
  return lastRes!;
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
      url.searchParams.set("q", buildSearchQuery(query));
      url.searchParams.set("maxResults", "20");
      url.searchParams.set("printType", "books");
      url.searchParams.set("country", "TR");
      url.searchParams.set("key", env.GOOGLE_BOOKS_KEY);

      const res = await fetchWithRetry(url);
      if (!res.ok) {
        const details = await res.text();
        return reply.code(res.status).send({ error: "Google Books API error", details });
      }

      const data = (await res.json()) as GoogleBooksResponse;
      return reply.send(data.items ?? []);
    },
  );
}
