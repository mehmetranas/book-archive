/// <reference path="../pb_data/types.d.ts" />

console.log("--> Character Analysis Worker (TURKISH STRICT) Hazir...");

// --- CRON JOB ---
cronAdd("character_analysis_job", "* * * * *", () => {

    const apiKey = $os.getenv("GEMINI_KEY");
    if (!apiKey) return;

    function bytesToString(bytes) {
        if (!bytes) return "";
        try {
            return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes)));
        } catch (e) {
            return String.fromCharCode.apply(null, bytes);
        }
    }

    try {
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
                    freshBook.set("character_map", cachedBook.get("character_map"));
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

                const res = $http.send({
                    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey,
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }]
                    }),
                    timeout: 60
                });

                if (res.statusCode !== 200) throw new Error("AI Error: " + res.raw);

                let rawText = JSON.parse(res.raw).candidates[0].content.parts[0].text;
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