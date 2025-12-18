/// <reference path="../pb_data/types.d.ts" />

console.log("--> Book Enrichment Worker (AI Summary) Hazir...");

// --- CRON JOB ---
cronAdd("book_enrichment_job", "* * * * *", () => {
    // Pollinations AI (optional key, but good to have)
    // const apiKey = $os.getenv("POLLINATION_KEY");

    try {
        // 0. TEMIZLIK: 10 dakikadan uzun suredir 'processing' olanlari 'failed' yap (Timeout)
        try {
            // JS tarafında 10 dk öncesini hesapla
            const d = new Date();
            d.setMinutes(d.getMinutes() - 10);
            const threshold = d.toISOString().replace('T', ' ').substring(0, 19) + ".000Z";

            const staleRecords = $app.findRecordsByFilter(
                "books",
                `enrichment_status = 'processing' && updated < '${threshold}'`,
                "-updated",
                10
            );

            if (staleRecords.length > 0) {
                console.log(`[BookEnrich] ${staleRecords.length} adet zaman asimina ugramis islem kontrol ediliyor...`);
                staleRecords.forEach((rec) => {
                    const currentNotes = rec.get("ai_notes") || "";

                    // Eger zaten bir kez timeout olduysa, artik vazgec
                    if (currentNotes.includes("Timeout")) {
                        rec.set("enrichment_status", "none"); // Vazgec (Basa don)
                        rec.set("ai_notes", currentNotes + " | Final Failure: Max retry reached.");
                        console.log(`[BookEnrich] Give up on: ${rec.id}`);
                    } else {
                        // Ilk kez timeout oluyorsa sans ver
                        rec.set("enrichment_status", "pending");
                        rec.set("ai_notes", currentNotes + " [Timeout: Retrying...]");
                    }
                    $app.save(rec);
                });
            }
        } catch (err) {
            console.log("[BookEnrich] Cleanup Error:", err);
        }

        // 1. Zenginlestirme bekleyen kitaplari bul
        // description alani bos olan veya enrichment_status 'pending' olanlar
        const records = $app.findRecordsByFilter(
            "books",
            "enrichment_status = 'pending'",
            "-created",
            5
        );

        if (records.length === 0) return;

        // Byte array to string helper
        function bytesToString(bytes) {
            if (!bytes) return "";
            try {
                return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes)));
            } catch (e) {
                return String.fromCharCode.apply(null, bytes);
            }
        }

        console.log(`[BookEnrich] ${records.length} kitap detaylandiriliyor...`);

        records.forEach((book) => {
            const title = book.get("title");

            // Yazar bilgisini duzgun coz (Bazen byte array [34, 65...] gelebilir)
            let author = "";
            const rawAuthors = book.get("authors");
            try {
                if (Array.isArray(rawAuthors) && rawAuthors.length > 0 && typeof rawAuthors[0] === 'number') {
                    // Sayi dizisi ise string'e cevir
                    let decoded = bytesToString(rawAuthors);
                    // Bazen ["Yazar Adi"] seklinde stringify edilmis json da olabilir
                    try {
                        const parsed = JSON.parse(decoded);
                        author = Array.isArray(parsed) ? parsed.join(", ") : parsed;
                    } catch (e) {
                        author = decoded;
                    }
                } else if (Array.isArray(rawAuthors)) {
                    author = rawAuthors.join(", ");
                } else {
                    author = String(rawAuthors);
                }
            } catch (e) {
                author = String(rawAuthors);
            }

            // Temizlik: Koseli parantez veya tirnak kaldiysa temizle
            author = author.replace(/[\[\]"]/g, "").trim();

            // Durumu guncelle
            book.set("enrichment_status", "processing");
            $app.save(book);

            try {
                // --- PROMPT ---
                const promptText = `
### ROLE
You are an expert Literary Data Analyst and Librarian AI. Your task is to generate structured, high-quality metadata for a given book to populate a "Second Brain" reading application.

### INPUT DATA
Book Title: "${title}"
Author: "${author}"

### OUTPUT FORMAT
You must output a SINGLE valid JSON object. Do not include markdown formatting (like \`\`\`json), preambles, or explanations. Just the raw JSON object.

### JSON SCHEMA & CONTENT RULES
{
  "description": "String. A detailed, engaging, and literary summary of the book (3-4 sentences). It should capture the plot and the philosophical depth. LANGUAGE: TURKISH.",
  "tags": ["String", "String", ...], // Array of strings. 5-7 conceptual tags (e.g., 'varoluşçuluk', 'baba-oğul', 'distopya'). Lowercase. LANGUAGE: TURKISH.
  "page_count": Integer, // Estimated page count.
  "spotify_keyword": "String. The BEST search query to find a matching 'ambient' or 'mood' playlist on Spotify. Focus on genre, mood, and instruments (e.g., 'gloomy cello', 'dark academia', 'jazz noir'). LANGUAGE: ENGLISH (Must be English for better API results).",
  "primary_color": "String", // HEX color code (e.g., '#2A2A2A') that best represents the book's cover or atmosphere.
  "mood": "String", // One word summary of the atmosphere (e.g., 'Melankolik', 'Gergin', 'Epik'). LANGUAGE: TURKISH.
  "movie_suggestion": {
      "has_movie": Boolean, // true if a relevant movie exists.
      "title": "String", // Title of the movie. LANGUAGE: ENGLISH.
      "year": "String", // Release year of the movie.
      "relation_type": "String" // CRITICAL: Must be 'Adaptation' ONLY if the movie is officially based on this specific book (verify author credit). If a movie shares the same title but has a different plot (e.g., 'The Lemon Tree' book vs 'Lemon Tree' movie), OR if no direct adaptation exists, choose a movie with similar themes and set this to 'Vibe Match'."
  }
}

### CONSTRAINTS
- Ensure the JSON is valid and parsable.
- The 'spotify_keyword' and 'movie_suggestion.title' must be in English.
- The 'description' and 'tags' must be in TURKISH.
- **ANTI-HALLUCINATION RULE:** Do not assume a movie is an adaptation just because it shares the book's title. Verify the plot and credits. If the book is non-fiction and the movie is fiction (or vice versa) with different stories, it is NOT an adaptation. Use 'Vibe Match' instead.

### EXAMPLE OUTPUT
{
  "description": "Çöl gezegeni Arrakis'te geçen, politika, din ve ekolojinin iç içe geçtiği epik bir bilimkurgu şaheseri. Genç Paul Atreides'in, evrenin en değerli kaynağı olan 'baharat' uğruna verilen savaşta liderliğe yükselişini ve kaderiyle yüzleşmesini konu alır.",
  "tags": ["bilimkurgu", "politika", "ekoloji", "din", "iktidar mücadelesi", "mesih", "uzay operası"],
  "page_count": 712,
  "spotify_keyword": "middle eastern desert ambient sci-fi soundtrack",
  "primary_color": "#C2B280",
  "mood": "Epik",
  "movie_suggestion": {
      "has_movie": true,
      "title": "Dune: Part One",
      "year": "2021",
      "relation_type": "Adaptation"
  }
}
                `;

                // --- Pollinations AI Request ---
                const pollinationKey = $os.getenv("POLLINATION_KEY") || "";
                if (!pollinationKey) throw new Error("POLLINATION_KEY not set");

                // Construct full URL with seed (random or specific)
                const url = `https://text.pollinations.ai/${encodeURIComponent(promptText)}?json=true&model=openai`;

                const res = $http.send({
                    url: url,
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${pollinationKey}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 120 // Increased timeout for generation
                });

                if (res.statusCode !== 200) throw new Error("AI API Error: " + res.raw);

                // --- Response Parsing ---
                // Pollinations returns existing text directly
                let rawText = res.raw;

                // JSON blok temizligi (bazen markdown veya fazladan text gelebilir)
                rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

                const firstBrace = rawText.indexOf('{');
                const lastBrace = rawText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    rawText = rawText.substring(firstBrace, lastBrace + 1);
                }

                const aiData = JSON.parse(rawText);

                // --- Kaydet ---
                // Eger kitabin orijinal aciklamasi cok kisaysa (<50 karakter) veya yoksa, AI'in yazdigini kullan
                const currentDesc = book.get("description") || "";

                if (currentDesc.length < 50 && aiData.description) {
                    book.set("description", aiData.description);
                }

                // Eger sayfa sayisi yoksa veya 0 ise AI'in tahminini kullan
                const currentPageCount = book.getInt("page_count");
                if ((!currentPageCount || currentPageCount === 0) && aiData.page_count) {
                    book.set("page_count", parseInt(aiData.page_count));
                }

                // Tagleri kaydet
                if (aiData.tags && Array.isArray(aiData.tags)) {
                    book.set("tags", aiData.tags);
                }

                // Yeni Alanlar (Spotify & Mood & Movie Suggestion)
                if (aiData.spotify_keyword) {
                    book.set("spotify_keyword", aiData.spotify_keyword);
                }
                if (aiData.mood) {
                    book.set("mood", aiData.mood);
                }
                if (aiData.primary_color) {
                    book.set("primary_color", aiData.primary_color);
                }
                if (aiData.movie_suggestion) {
                    book.set("movie_suggestion", aiData.movie_suggestion);
                }

                book.set("enrichment_status", "completed");
                $app.save(book);
                console.log(`[BookEnrich] Tamamlandi: ${title}`);

            } catch (err) {
                console.log(`[BookEnrich] Hata (${title}): ${err}`);
                // Hata durumunda tekrar denemesi icin failed degil, belki pending birakilabilir ama simdilik failed
                try {
                    const failBook = $app.findRecordById("books", book.id);
                    failBook.set("enrichment_status", "failed");
                    failBook.set("ai_notes", "Enrich Error: " + err.toString().substring(0, 100));
                    $app.save(failBook);
                } catch (e) { }
            }
        });

    } catch (e) {
        console.log("[BookEnrich] Fatal Error:", e);
    }
});
