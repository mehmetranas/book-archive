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

                // --- Pollinations AI Request ---
                const pollinationKey = $os.getenv("POLLINATION_KEY") || "";

                // Pollinations GET request with prompt in URL
                // Note: encodeURIComponent is standard JS.
                const encodedPrompt = encodeURIComponent(promptText);
                const url = `https://gen.pollinations.ai/text/${encodedPrompt}?model=nova-micro`;

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

                // ai_notes alanina etiketleri veya ekstra bilgileri koyabiliriz
                // Tagleri kaydet (DB'de 'tags' adinda JSON alani olmali)
                if (aiData.tags && Array.isArray(aiData.tags)) {
                    book.set("tags", aiData.tags);
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
