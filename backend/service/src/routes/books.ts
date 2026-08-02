import type { FastifyInstance } from "fastify";
import type { RecordModel } from "pocketbase";
import { requireAuth } from "../lib/auth.js";
import { pb, withAdminAuth } from "../lib/pocketbase-admin-client.js";
import { buildFilter } from "../lib/pb-filter.js";
import { logger } from "../lib/logger.js";
import { runBookEnrichment } from "../workers/book-enrichment.worker.js";
import { runCharacterAnalysis } from "../workers/character-gen.worker.js";

interface CreateBookBody {
  title: string;
  authors?: string[];
  cover_url?: string;
  isbn?: string;
  google_books_id?: string;
  page_count?: number;
  description?: string;
  status?: string;
  language_code?: string;
}

/**
 * Loads a book by id and verifies it belongs to `userId`. Returns null for
 * both "doesn't exist" and "belongs to someone else" - the service now calls
 * PocketBase as superuser, so this ownership check replaces what used to be
 * a PB API rule (`user = @request.auth.id`). Collapsing not-found/forbidden
 * into one 404 avoids leaking whether a given id belongs to another user.
 */
async function loadOwnedBook(id: string, userId: string): Promise<RecordModel | null> {
  try {
    const book = await withAdminAuth(() => pb.collection("books").getOne(id));
    return book.user === userId ? book : null;
  } catch {
    return null;
  }
}

async function findStorytell(params: {
  isbn?: string;
  google_books_id?: string;
  title: string;
}): Promise<RecordModel | null> {
  const { isbn, google_books_id, title } = params;

  if (isbn) {
    try {
      return await withAdminAuth(() =>
        pb.collection("storytell").getFirstListItem(buildFilter("isbn = {:isbn}", { isbn })),
      );
    } catch {
      /* fall through */
    }
  }

  if (google_books_id) {
    try {
      return await withAdminAuth(() =>
        pb
          .collection("storytell")
          .getFirstListItem(buildFilter("google_books_id = {:id}", { id: google_books_id })),
      );
    } catch {
      /* fall through */
    }
  }

  try {
    return await withAdminAuth(() =>
      pb.collection("storytell").getFirstListItem(buildFilter("title ~ {:title}", { title })),
    );
  } catch {
    return null;
  }
}

export async function booksRoute(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      status?: string;
      in_library?: string;
      is_archived?: string;
      search?: string;
      page?: string;
      perPage?: string;
    };
  }>("/books", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const { status, in_library, is_archived, search } = request.query;
    const page = Math.max(Number(request.query.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(request.query.perPage) || 20, 1), 100);

    const filterParts = [buildFilter("user = {:userId}", { userId })];
    if (status) filterParts.push(buildFilter("status = {:status}", { status }));
    if (in_library !== undefined) {
      filterParts.push(buildFilter("in_library = {:v}", { v: in_library === "true" }));
    }
    if (is_archived !== undefined) {
      filterParts.push(buildFilter("is_archived = {:v}", { v: is_archived === "true" }));
    }
    if (search) {
      filterParts.push(buildFilter("(title ~ {:q} || authors ~ {:q})", { q: search }));
    }

    const result = await withAdminAuth(() =>
      pb.collection("books").getList(page, perPage, {
        filter: filterParts.join(" && "),
        sort: "-created",
      }),
    );
    return reply.send(result);
  });

  app.get("/books/stats", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const books = await withAdminAuth(() =>
      pb.collection("books").getFullList({
        filter: buildFilter("user = {:userId} && status = {:status}", { userId, status: "read" }),
      }),
    );

    const totalBooks = books.length;
    const totalPages = books.reduce((sum, b) => sum + (Number(b.page_count) || 0), 0);
    const avgPages = totalBooks > 0 ? Math.round(totalPages / totalBooks) : 0;

    return reply.send({ totalBooks, totalPages, avgPages });
  });

  app.get<{ Params: { id: string } }>(
    "/books/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const book = await loadOwnedBook(request.params.id, request.user!.id);
      if (!book) return reply.code(404).send({ error: "Not found" });

      let globalBook: RecordModel | null = null;
      if (book.character_map) {
        globalBook = await withAdminAuth(() =>
          pb.collection("global_books").getOne(book.character_map),
        ).catch(() => null);
      }

      return reply.send({ ...book, character_map: globalBook });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/books/:id/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const book = await loadOwnedBook(request.params.id, request.user!.id);
      if (!book) return reply.code(404).send({ error: "Not found" });

      return reply.send({
        id: book.id,
        updated: book.updated,
        enrichment_status: book.enrichment_status,
        character_analysis_status: book.character_analysis_status,
        image_gen_status: book.image_gen_status,
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/books/:id/notes",
    { preHandler: requireAuth },
    async (request, reply) => {
      const book = await loadOwnedBook(request.params.id, request.user!.id);
      if (!book) return reply.code(404).send({ error: "Not found" });

      const notes = await withAdminAuth(() =>
        pb.collection("notes").getFullList({
          filter: buildFilter("book = {:id}", { id: book.id }),
          sort: "-created",
        }),
      );
      return reply.send(notes);
    },
  );

  app.post<{ Body: CreateBookBody }>("/books", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const body = request.body;
    if (!body?.title) {
      return reply.code(400).send({ error: "title is required" });
    }

    const settings = (user.settings as { auto_ai_enrichment?: boolean } | undefined) ?? {};
    const enrichmentStatus = settings.auto_ai_enrichment ? "pending" : "none";

    const storytell = await findStorytell({
      isbn: body.isbn,
      google_books_id: body.google_books_id,
      title: body.title,
    });

    const book = await withAdminAuth(() =>
      pb.collection("books").create({
        title: body.title,
        authors: body.authors ?? [],
        cover_url: body.cover_url ?? "",
        isbn: body.isbn ?? "",
        google_books_id: body.google_books_id ?? "",
        page_count: body.page_count ?? 0,
        description: body.description ?? "",
        status: body.status ?? "want_to_read",
        language_code: body.language_code ?? "en",
        user: user.id,
        enrichment_status: enrichmentStatus,
        ...(storytell ? { storytell: { id: storytell.id, url: storytell.url } } : {}),
      }),
    );

    if (enrichmentStatus === "pending") {
      void runBookEnrichment(book.id).catch((err) =>
        logger.error({ err, bookId: book.id }, "[books] Inline enrichment trigger failed"),
      );
    }

    return reply.code(201).send(book);
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/books/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const book = await loadOwnedBook(request.params.id, request.user!.id);
      if (!book) return reply.code(404).send({ error: "Not found" });

      // Never let the client reassign ownership or the primary key via a PATCH body.
      const { user: _user, id: _id, ...safeBody } = request.body ?? {};

      const updated = await withAdminAuth(() => pb.collection("books").update(book.id, safeBody));
      return reply.send(updated);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/books/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const book = await loadOwnedBook(request.params.id, request.user!.id);
      if (!book) return reply.code(404).send({ error: "Not found" });

      await withAdminAuth(() => pb.collection("books").delete(book.id));
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/books/:id/enrich",
    { preHandler: requireAuth },
    async (request, reply) => {
      const book = await loadOwnedBook(request.params.id, request.user!.id);
      if (!book) return reply.code(404).send({ error: "Not found" });

      await withAdminAuth(() =>
        pb.collection("books").update(book.id, { enrichment_status: "pending" }),
      );
      void runBookEnrichment(book.id).catch((err) =>
        logger.error({ err, bookId: book.id }, "[books] Inline enrichment trigger failed"),
      );

      return reply.send({ enrichment_status: "pending" });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/books/:id/analyze-characters",
    { preHandler: requireAuth },
    async (request, reply) => {
      const book = await loadOwnedBook(request.params.id, request.user!.id);
      if (!book) return reply.code(404).send({ error: "Not found" });

      const title = book.title as string;
      const cached = await withAdminAuth(() =>
        pb.collection("global_books").getFirstListItem(buildFilter("title = {:title}", { title })),
      ).catch(() => null);

      if (cached && cached.character_map) {
        await withAdminAuth(() =>
          pb.collection("books").update(book.id, {
            character_map: cached.id,
            character_analysis_status: "completed",
          }),
        );
        return reply.send({ character_analysis_status: "completed", cached: true });
      }

      await withAdminAuth(() =>
        pb.collection("books").update(book.id, { character_analysis_status: "pending" }),
      );
      void runCharacterAnalysis(book.id).catch((err) =>
        logger.error({ err, bookId: book.id }, "[books] Inline character analysis trigger failed"),
      );

      return reply.send({ character_analysis_status: "pending", cached: false });
    },
  );
}
