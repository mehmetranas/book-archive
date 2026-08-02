import { pb, withAdminAuth } from "../lib/pocketbase-admin-client.js";
import { buildFilter } from "../lib/pb-filter.js";
import { ENRICHMENT_MODELS, extractJson, fetchWithFallback } from "../lib/openrouter.js";
import { chargeEnrichmentCost } from "../lib/credits.js";
import { logger } from "../lib/logger.js";

interface EnrichmentResult {
  description?: string;
  tags?: string[];
  page_count?: number;
  spotify_keyword?: string;
  primary_color?: string;
  mood?: string;
  movie_suggestion?: unknown;
  note?: {
    cleaned_text?: string;
    summary?: string;
    tags?: string[];
    sentiment?: string;
  };
}

function buildPrompt(title: string, author: string): string {
  return `
### ROLE
You are a Senior Literary Researcher and Metadata Specialist. Your goal is to extract or generate high-quality, ACCURATE metadata for the following book.

### INPUT DATA
Book Title: "${title}"
Author: "${author}"

### HALLUCINATION PREVENTION (CRITICAL)
1. **NO INVENTIONS**: If you cannot find reliable information about this EXACT book and author, do NOT make it up. Instead, set 'description' to a generic genre-based summary and all other specific fields to null or logical defaults.
2. **METADATA INTEGRITY**: Only provide a 'page_count' if it is a commonly accepted value for major editions.
3. **MOVIE VERIFICATION**: Do not assume a movie is an adaptation just because of the title. Verify the specific author and plot. If in doubt, use 'Vibe Match' or has_movie: false.

### OUTPUT FORMAT
JSON only. No markdown.

### JSON SCHEMA & CONTENT RULES
{
  "description": "Engaging summary (3-4 sentences). Focus on theme and plot. LANGUAGE: TURKISH.",
  "tags": ["String", ...], // 5-7 conceptual/genre tags. Lowercase. LANGUAGE: TURKISH.
  "page_count": Integer, // Realistic estimate.
  "spotify_keyword": "Best mood/ambient keyword (e.g., 'dark cello suspense'). LANGUAGE: ENGLISH.",
  "primary_color": "HEX code representing the book's vibe/cover.",
  "mood": "One word atmosphere (e.g., 'Melankolik'). LANGUAGE: TURKISH.",
  "movie_suggestion": {
      "has_movie": Boolean,
      "title": "String (ENGLISH)",
      "year": "String",
      "relation_type": "Adaptation" or "Vibe Match"
  },
  "note": {
      "cleaned_text": "A short, evocative passage or insight from the book (2-4 sentences), suitable as a 'smart note' preview for the reader. LANGUAGE: TURKISH.",
      "summary": "One-sentence summary of that passage. LANGUAGE: TURKISH.",
      "tags": ["String", ...], // 2-4 short topical tags for this note. Lowercase. LANGUAGE: TURKISH.
      "sentiment": "One word emotional tone of the note (e.g. 'Umutlu', 'Hüzünlü'). LANGUAGE: TURKISH."
  }
}

### EXAMPLES
Input: "Fahrenheit 451", "Ray Bradbury"
Response: {
  "description": "Kitapların yakıldığı, düşünmenin suç sayıldığı distopik bir geleceği konu alır. İtfaiyeci Guy Montag'ın yavaş yavaş sistemin korkunçluğunu fark etmesi ve direnişe geçmesini anlatır.",
  "tags": ["distopya", "sansür", "bilimkurgu", "klasik", "sosyal eleştiri"],
  "page_count": 256,
  "spotify_keyword": "melancholic electronic dystopian ambient",
  "primary_color": "#E25822",
  "mood": "Gerilimli",
  "movie_suggestion": {
      "has_movie": true,
      "title": "Fahrenheit 451",
      "year": "1966",
      "relation_type": "Adaptation"
  },
  "note": {
      "cleaned_text": "\\"Birisi bana neden mutlu olmadığımı sorarsa gerçekten şaşırırdım. Ben mutluyum sanıyordum.\\" - Montag'ın uyanışının başladığı an, sorgulanmamış bir mutluluğun sahteliğini ortaya koyar.",
      "summary": "Montag'ın kendi mutluluğunu sorgulamaya başladığı dönüm noktası.",
      "tags": ["uyanış", "sorgulama", "mutluluk"],
      "sentiment": "Rahatsız Edici"
  }
}

### SELF-CORRECTION LOOP
- Is this the correct author for this book?
- Did I invent the plot?
- Are 'description', 'tags', 'mood', and 'note' fields in Turkish?
`;
}

export async function runBookEnrichment(bookId: string): Promise<void> {
  const book = await withAdminAuth(() => pb.collection("books").getOne(bookId));
  const title = String(book.title ?? "");
  const author = Array.isArray(book.authors) ? book.authors.join(", ") : String(book.authors ?? "");

  await withAdminAuth(() =>
    pb.collection("books").update(bookId, { enrichment_status: "processing" }),
  );

  try {
    const raw = await fetchWithFallback(buildPrompt(title, author), ENRICHMENT_MODELS);
    const aiData = JSON.parse(extractJson(raw)) as EnrichmentResult;

    const patch: Record<string, unknown> = {};

    const currentDescription = String(book.description ?? "");
    if (currentDescription.length < 50 && aiData.description) {
      patch.description = aiData.description;
    }

    const currentPageCount = Number(book.page_count) || 0;
    if (currentPageCount === 0 && aiData.page_count) {
      patch.page_count = Math.trunc(Number(aiData.page_count));
    }

    if (Array.isArray(aiData.tags)) patch.tags = aiData.tags;
    if (aiData.spotify_keyword) patch.spotify_keyword = aiData.spotify_keyword;
    if (aiData.mood) patch.mood = aiData.mood;
    if (aiData.primary_color) patch.primary_color = aiData.primary_color;
    if (aiData.movie_suggestion) patch.movie_suggestion = aiData.movie_suggestion;

    patch.enrichment_status = "completed";
    await withAdminAuth(() => pb.collection("books").update(bookId, patch));

    if (aiData.note) {
      await upsertNote(bookId, aiData.note);
    }

    if (book.user) {
      await chargeEnrichmentCost(String(book.user));
    }

    logger.info({ bookId, title }, "[book-enrichment] Completed");
  } catch (err) {
    logger.error({ err, bookId, title }, "[book-enrichment] Failed");
    await withAdminAuth(() =>
      pb.collection("books").update(bookId, {
        enrichment_status: "failed",
        ai_notes: `Enrich Error: ${String(err).substring(0, 100)}`,
      }),
    ).catch(() => undefined);
  }
}

async function upsertNote(
  bookId: string,
  note: NonNullable<EnrichmentResult["note"]>,
): Promise<void> {
  const data = {
    book: bookId,
    cleaned_text: note.cleaned_text ?? "",
    summary: note.summary ?? "",
    tags: Array.isArray(note.tags) ? note.tags : [],
    sentiment: note.sentiment ?? "",
  };

  try {
    const existing = await withAdminAuth(() =>
      pb.collection("notes").getFirstListItem(buildFilter("book = {:bookId}", { bookId })),
    );
    await withAdminAuth(() => pb.collection("notes").update(existing.id, data));
  } catch {
    await withAdminAuth(() => pb.collection("notes").create(data)).catch((err) =>
      logger.warn({ err, bookId }, "[book-enrichment] Failed to create note"),
    );
  }
}
