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

        // Fallback Strategy function
        function fetchWithFallback(prompt, key) {
            const models = ["openai", "gemini-search", "openai-fast"];
            let lastError = null;

            for (const model of models) {
                try {
                    // console.log(`[BookEnrich] Trying model: ${model}...`);
                    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?json=true&model=${model}`;

                    const res = $http.send({
                        url: url,
                        method: "GET",
                        headers: {
                            "Authorization": `Bearer ${key}`,
                            "Content-Type": "application/json"
                        },
                        timeout: 120
                    });

                    if (res.statusCode === 200) {
                        console.log(`[BookEnrich] Success with model: ${model}`);
                        return res;
                    }
                    console.log(`[BookEnrich] Model ${model} failed (Status: ${res.statusCode}). Next...`);
                } catch (e) {
                    console.log(`[BookEnrich] Model ${model} error: ${e}. Next...`);
                    lastError = e;
                }
            }
            throw new Error("All AI models failed. Last Error: " + lastError);
        }

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
  }
}

### SELF-CORRECTION LOOP
- Is this the correct author for this book?
- Did I invent the plot?
- Are 'description', 'tags', and 'mood' in Turkish?
                `;

                // --- Pollinations AI Request ---
                const pollinationKey = $os.getenv("POLLINATION_KEY") || "";
                if (!pollinationKey) throw new Error("POLLINATION_KEY not set");

                const res = fetchWithFallback(promptText, pollinationKey);

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
                // --- Kaydet ---
                const currentDesc = book.get("description") || "";

                // MANTIKSAL KARAR:
                // Google Books'tan gelen (veya elle girilen) bir aciklama varsa, AI'in urettigini kullanma.
                // Sadece aciklama cok kisaysa (<50 karakter) veya yoksa guncelle.
                if (currentDesc.length >= 50) {
                    console.log(`[BookEnrich] Mevcut aciklama korunuyor (${currentDesc.length} chars). AI aciklamasi atlandi.`);
                } else if (aiData.description) {
                    console.log(`[BookEnrich] Aciklama guncelleniyor (AI)...`);
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

                // ---------------------------------------------------------
                // KREDI DUSME LOGIC
                // ---------------------------------------------------------
                try {
                    // 1. Guncel Fiyati Oku
                    let cost = 0;

                    try {
                        // "ai_pricing" JSON alani oldugu icin filtrede sorun olabilir. Standart "created" ile cekiyoruz.
                        const settingRecord = $app.findFirstRecordByFilter("system_settings", "created != ''");

                        if (settingRecord) {
                            // getString() otomatk olarak string'e cevirir (byte array veya text fark etmez)
                            let aiPricingStr = settingRecord.getString("ai_pricing");
                            let aiPricing = {};

                            try {
                                aiPricing = JSON.parse(aiPricingStr);
                            } catch (e) {
                                console.log(`[BookEnrich] Pricing Parse Error: ${e}`);
                            }

                            // 3. Veri Okuma
                            if (aiPricing) {
                                let rawCost = aiPricing.enrichment_cost;
                                // String gelebilir ("1"), Number'a cevir
                                cost = Number(rawCost) || 0;
                            }
                            console.log(`[BookEnrich] Fiyat Bilgisi Alindi: ${cost}`);
                        } else {
                            console.log("[BookEnrich] Ayar kaydi bulunamadi (system_settings tablosu bos).");
                        }
                    } catch (sErr) {
                        console.log(`[BookEnrich] Ayar okuma hatasi: ${sErr}`);
                    }

                    // 2. Kredi Dus
                    if (cost > 0) {
                        const userId = book.getString("user");
                        if (userId) {
                            try {
                                const userRec = $app.findRecordById("users", userId);
                                const currentCredits = userRec.getInt("credits");

                                // Eksiye dusme kontrolu (backend logic)
                                const newCredits = (currentCredits - cost);
                                const finalCredits = newCredits < 0 ? 0 : newCredits;

                                userRec.set("credits", finalCredits);
                                $app.save(userRec);
                                console.log(`[BookEnrich] CHARGED User: ${userId} | Cost: ${cost} | NewBalance: ${finalCredits}`);
                            } catch (uErr) {
                                console.log(`[BookEnrich] User charge error: ${uErr}`);
                            }
                        } else {
                            console.log("[BookEnrich] User ID missing on book record.");
                        }
                    } else {
                        console.log(`[BookEnrich] Islem ucretsiz. Cost found: ${cost}`);
                    }

                } catch (creditErr) {
                    console.log(`[BookEnrich] General Credit Error: ${creditErr}`);
                }


                // ---------------------------------------------------------

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
