/// <reference path="../pb_data/types.d.ts" />

console.log("--> Character Analysis Worker (TURKISH STRICT) Hazir...");

// --- CRON JOB ---
cronAdd("character_analysis_job", "* * * * *", () => {

    // OpenRouter AI
    // const apiKey = $os.getenv("OPENROUTER_API_KEY");

    function bytesToString(bytes) {
        if (!bytes) return "";
        try {
            return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes)));
        } catch (e) {
            return String.fromCharCode.apply(null, bytes);
        }
    }

    try {
        // 0. TEMIZLIK: 10 dakikadan uzun suredir 'processing' olanlari 'failed' yap (Timeout)
        try {
            // JS tarafında 10 dk öncesini hesapla
            const d = new Date();
            d.setMinutes(d.getMinutes() - 10);
            const threshold = d.toISOString().replace('T', ' ').substring(0, 19) + ".000Z";

            const staleRecords = $app.findRecordsByFilter(
                "books",
                `character_analysis_status = 'processing' && updated < '${threshold}'`,
                "-updated",
                10
            );

            if (staleRecords.length > 0) {
                console.log(`[CharJob] ${staleRecords.length} adet zaman asimina ugramis analiz kontrol ediliyor...`);
                staleRecords.forEach((rec) => {
                    // Karakter analizi icin de ai_notes alanini (veya baska bir log alanini) kullanalim
                    // Eger ai_notes yoksa hata vermez, bos doner.
                    let notes = "";
                    try { notes = rec.get("ai_notes") || ""; } catch (e) { }

                    if (notes.includes("CharTimeout")) {
                        rec.set("character_analysis_status", "none");
                        // Istersek notu guncelleyebiliriz ama cok sismesi riskli, log'a yazalim
                        console.log(`[CharJob] Max Retries Exceeded: ${rec.id}`);
                    } else {
                        rec.set("character_analysis_status", "pending");
                        try { rec.set("ai_notes", notes + " [CharTimeout]"); } catch (e) { }
                    }
                    $app.save(rec);
                });
            }
        } catch (err) {
            console.log("[CharJob] Cleanup Error:", err);
        }

        // 1. Bekleyenleri bul
        const records = $app.findRecordsByFilter(
            "books",
            "character_analysis_status = 'pending'",
            "-created",
            5
        );

        if (records.length === 0) return;

        console.log(`[CharJob] ${records.length} kitap isleniyor...`);

        records.forEach((initialRecord) => {
            const bookId = initialRecord.id;
            const title = initialRecord.get("title");

            // Durumu 'processing' yap
            initialRecord.set("character_analysis_status", "processing");
            $app.save(initialRecord);

            let author = "";
            const rawAuthors = initialRecord.get("authors");
            try {
                if (Array.isArray(rawAuthors) && rawAuthors.length > 0 && typeof rawAuthors[0] === 'number') {
                    author = JSON.parse(bytesToString(rawAuthors)).join(", ");
                } else if (Array.isArray(rawAuthors)) {
                    author = rawAuthors.join(", ");
                } else {
                    author = String(rawAuthors);
                }
            } catch (e) { }

            // --- GLOBAL CACHE ---
            try {
                const cachedBook = $app.findFirstRecordByFilter(
                    "global_books",
                    `title = '${title.replace(/'/g, "\\'")}'`
                );

                if (cachedBook && cachedBook.get("character_map")) {
                    console.log(`[CharJob] Cache HIT: ${title}`);
                    const freshBook = $app.findRecordById("books", bookId);
                    freshBook.set("character_map", cachedBook.id);
                    freshBook.set("character_analysis_status", "completed");
                    $app.save(freshBook);
                    return;
                }
            } catch (e) {
                console.log(`[CharJob] Cache MISS: ${title}`);
            }

            // --- AI ANALİZİ (TÜRKÇE PROMPT) ---
            try {
                const promptText = `
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

                // --- OpenRouter AI Request ---
                const openRouterKey = $os.getenv("OPENROUTER_API_KEY") || "";

                const res = $http.send({
                    url: "https://openrouter.ai/api/v1/chat/completions",
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${openRouterKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "google/gemini-2.0-flash-001",
                        messages: [{ role: "user", content: promptText }]
                    }),
                    timeout: 120
                });

                if (res.statusCode !== 200) throw new Error("AI Error: " + res.raw);

                const envelope = JSON.parse(res.raw);
                let rawText = (envelope.choices && envelope.choices[0] && envelope.choices[0].message && envelope.choices[0].message.content) || "";
                rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

                const firstBracket = rawText.indexOf('[');
                const lastBracket = rawText.lastIndexOf(']');
                if (firstBracket !== -1 && lastBracket !== -1) {
                    rawText = rawText.substring(firstBracket, lastBracket + 1);
                }

                const charData = JSON.parse(rawText);

                $app.runInTransaction((txApp) => {
                    // 1. Global Book İşlemleri
                    let globalBookId = "";
                    const globalCollection = txApp.findCollectionByNameOrId("global_books");

                    try {
                        // Önce var mı diye bak
                        const existingGlobal = txApp.findFirstRecordByFilter(
                            "global_books",
                            `title = '${title.replace(/'/g, "\\'")}'`
                        );

                        // Varsa güncelle
                        existingGlobal.set("character_map", charData);
                        existingGlobal.set("character_analysis_status", "completed");
                        if (author) existingGlobal.set("author", author);
                        txApp.save(existingGlobal);
                        globalBookId = existingGlobal.id;

                    } catch (e) {
                        // Yoksa yeni oluştur
                        const newGlobal = new Record(globalCollection);
                        newGlobal.set("title", title);
                        newGlobal.set("author", author);
                        newGlobal.set("character_map", charData);
                        newGlobal.set("character_analysis_status", "completed");
                        txApp.save(newGlobal);
                        globalBookId = newGlobal.id;
                    }

                    // 2. Kitap Kaydını Güncelle (Relation ID ata)
                    const freshBook = txApp.findRecordById("books", bookId);
                    freshBook.set("character_map", globalBookId); // Relation olarak ID kaydediyoruz
                    freshBook.set("character_analysis_status", "completed");
                    txApp.save(freshBook);
                });

                console.log(`[CharJob] Analiz Tamamlandi (TR): ${title}`);

            } catch (err) {
                console.log(`[CharJob] Hata (${title}): ${err}`);
                try {
                    const failBook = $app.findRecordById("books", bookId);
                    failBook.set("character_analysis_status", "failed");
                    $app.save(failBook);
                } catch (e) { }
            }
        });

    } catch (e) {
        console.log("[CharJob] Query Error:", e);
    }
});