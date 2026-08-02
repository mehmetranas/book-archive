import { pb, withAdminAuth } from "../lib/pocketbase-admin-client.js";
import { buildFilter } from "../lib/pb-filter.js";
import { CHARACTER_GEN_MODELS, extractJson, fetchWithFallback } from "../lib/openrouter.js";
import { logger } from "../lib/logger.js";

interface CharacterEntry {
  name: string;
  role: string;
  traits: string[];
  relationships: { target: string; type: string; details: string }[];
}

function buildPrompt(title: string, author: string): string {
  return `
Rol: Uzman Edebiyat Analisti.
Gorev: Şu kitap için detaylı bir karakter haritası çıkar: "${title}" (Yazar: "${author}").
Hedef Dil: TÜRKÇE.

Talimatlar:
1. Kitaptaki ana ve önemli yan karakterleri belirle.
2. Her karakterin rolünü (Başkahraman, Kötü Adam, Yancı vb.), özelliklerini ve diğerleriyle ilişkisini TÜRKÇE olarak yaz.
3. Eğer kitap kurgu değilse (Yemek kitabı, sözlük vb.) boş dizi [] döndür.

KRİTİK KURALLAR:
- Çıktı SADECE geçerli bir JSON Dizisi (Array) olmalı.
- Markdown kullanma.
- Tüm metin değerleri (roller, özellikler, ilişki tipleri) TÜRKÇE olmalı.

JSON FORMATI ÖRNEĞİ:
[
  {
    "name": "Karakter Adı",
    "role": "Başkahraman",
    "traits": ["Cesur", "İnatçı", "Duygusal"],
    "relationships": [
      {"target": "Diğer Karakter", "type": "Arkadaş", "details": "Çocukluk arkadaşı"}
    ]
  }
]
`;
}

/**
 * Ports pocketjs.character-gen.js. The original hook wraps the global_books
 * upsert + books update in `$app.runInTransaction`, a PocketBase-internal
 * JSVM API with no equivalent over the external REST API - these become two
 * sequential, non-atomic calls here. Acceptable for a cache-population path:
 * worst case on a race is a duplicate `global_books` row for the same title,
 * not data corruption.
 */
export async function runCharacterAnalysis(bookId: string): Promise<void> {
  const book = await withAdminAuth(() => pb.collection("books").getOne(bookId));
  const title = String(book.title ?? "");
  const author = Array.isArray(book.authors) ? book.authors.join(", ") : String(book.authors ?? "");

  await withAdminAuth(() =>
    pb.collection("books").update(bookId, { character_analysis_status: "processing" }),
  );

  try {
    const cached = await withAdminAuth(() =>
      pb.collection("global_books").getFirstListItem(buildFilter("title = {:title}", { title })),
    ).catch(() => null);

    if (cached && cached.character_map) {
      await withAdminAuth(() =>
        pb.collection("books").update(bookId, {
          character_map: cached.id,
          character_analysis_status: "completed",
        }),
      );
      logger.info({ bookId, title }, "[character-gen] Cache hit");
      return;
    }

    const raw = await fetchWithFallback(buildPrompt(title, author), CHARACTER_GEN_MODELS);
    const characterMap = JSON.parse(extractJson(raw)) as CharacterEntry[];

    let globalBookId: string;
    if (cached) {
      await withAdminAuth(() =>
        pb.collection("global_books").update(cached.id, {
          character_map: characterMap,
          character_analysis_status: "completed",
          ...(author ? { author } : {}),
        }),
      );
      globalBookId = cached.id;
    } else {
      const created = await withAdminAuth(() =>
        pb.collection("global_books").create({
          title,
          author,
          character_map: characterMap,
          character_analysis_status: "completed",
        }),
      );
      globalBookId = created.id;
    }

    await withAdminAuth(() =>
      pb.collection("books").update(bookId, {
        character_map: globalBookId,
        character_analysis_status: "completed",
      }),
    );

    logger.info({ bookId, title }, "[character-gen] Completed");
  } catch (err) {
    logger.error({ err, bookId, title }, "[character-gen] Failed");
    await withAdminAuth(() =>
      pb.collection("books").update(bookId, { character_analysis_status: "failed" }),
    ).catch(() => undefined);
  }
}
