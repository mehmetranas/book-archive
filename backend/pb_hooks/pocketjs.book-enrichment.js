/// <reference path="../pb_data/types.d.ts" />

console.log("--> Book Enrichment Worker (AI Summary) Hazir...");

// --- CRON JOB ---
cronAdd("book_enrichment_job", "* * * * *", () => {
    const apiKey = $os.getenv("GEMINI_KEY");
    if (!apiKey) return;

    try {
        // 1. Zenginlestirme bekleyen kitaplari bul
        // description alani bos olan veya enrichment_status 'pending' olanlar
        const records = $app.findRecordsByFilter(
            "books",
            "enrichment_status = 'pending'",
            "-created",
            5
        );

        if (records.length === 0) return;

        console.log(`[BookEnrich] ${records.length} kitap detaylandiriliyor...`);

        records.forEach((book) => {
            const title = book.get("title");
            const authorRaw = book.get("authors");
            let author = Array.isArray(authorRaw) ? authorRaw.join(", ") : String(authorRaw);

            // Durumu guncelle
            book.set("enrichment_status", "processing");
            $app.save(book);

            try {
                // --- PROMPT ---
                const promptText = `
                    Gorev: Asagidaki kitap icin Turkce detayli icerik olustur.
                    Kitap: "${title}"
                    Yazar: "${author}"

                    İstenen Cikti (JSON Formatinda):
                    {
                        "description": "Kitabin detayli, ilgi cekici ve baglayici bir ozeti (en az 3-4 cumle). Eger zaten varsa, onu daha edebi hale getir.",
                        "tags": ["Etiket1", "Etiket2", "Etiket3", "Etiket4", "Etiket5"]
                    }
                    
                    Kurallar:
                    - Sadece gecerli bir JSON dondur.
                    - Dil tamamen TURKCE olsun.
                    - Markdown kullanma.
                `;

                // --- API Request ---
                const res = $http.send({
                    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }]
                    }),
                    timeout: 60
                });

                if (res.statusCode !== 200) throw new Error("AI API Error: " + res.raw);

                // --- Response Parsing ---
                let rawText = JSON.parse(res.raw).candidates[0].content.parts[0].text;
                rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

                // JSON blok temizligi
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

                // ai_notes alanina etiketleri veya ekstra bilgileri koyabiliriz
                if (aiData.tags && Array.isArray(aiData.tags)) {
                    // Mevcut not varsa koru, yoksa yeni ekle
                    // book.set("ai_notes", "Tags: " + aiData.tags.join(", "));
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
