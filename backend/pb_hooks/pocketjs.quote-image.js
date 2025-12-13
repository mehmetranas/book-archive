/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/ai/quote-image", (c) => {
    console.log("[QuoteImage/Direct] İstek geldi...");

    try {
        const data = c.requestInfo().body;
        const bookId = data.id;
        // Frontend artik hazır Ingilizce prompt gonderiyor
        const imagePrompt = data.imagePrompt || "";

        if (!bookId) {
            return c.json(400, { error: "bookId is required" });
        }
        if (!imagePrompt) {
            return c.json(400, { error: "imagePrompt is required" });
        }

        const book = $app.findRecordById("books", bookId);

        // Prompt Temizligi (Cok Agresif)
        // Sadece harf, rakam ve bosluk kalsin. Noktalama isaretleri URL'i bozabilir.
        const safePrompt = imagePrompt
            .replace(/[^a-zA-Z0-9\s,]/g, "") // Sadece alfanumerik ve virgul virgul
            .replace(/\s+/g, " ") // Fazla bosluklari sil
            .trim()
            .substring(0, 300); // 300 karakter limit

        console.log(`[QuoteImage/Direct] Prompt: ${safePrompt}`);

        const encodedPrompt = encodeURIComponent(safePrompt);
        const randomSeed = Math.floor(Math.random() * 100000);

        // Pollinations URL (Basitlestirilmis)
        // seed ve nologo'yu kaldirdim, standart 768x768 deneyelim (daha guvenli)
        const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=768&height=768&model=flux`;

        const pollinationKey = $os.getenv("POLLINATION_KEY") || "";

        console.log(`[QuoteImage/Direct] İndiriliyor...`);

        // 1. HTTP İsteği
        const res = $http.send({
            url: imageUrl,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${pollinationKey}`, // Varsa gonderir
                "User-Agent": "Mozilla/5.0"
            },
            timeout: 60
        });

        if (res.statusCode !== 200) {
            // Hatanin icerigini gorelim
            throw new Error(`API Hatasi (${res.statusCode}): ${res.raw ? res.raw.substring(0, 200) : 'No Body'}`);
        }

        // 2. Dosyaya Yazma
        const tmpImgPath = `/tmp/quote_${book.id}_${randomSeed}.jpg`;
        $os.writeFile(tmpImgPath, res.raw);

        // 3. Dosyayi Kaydet
        try {
            const file = $filesystem.fileFromPath(tmpImgPath);
            book.set("generated_image", file);
            book.set("image_gen_status", "completed");
            $app.save(book);
        } catch (err) {
            throw new Error(`File Save Error: ${err.toString()}`);
        }

        // Temizlik
        try { $os.remove(tmpImgPath); } catch (e) { }

        const fileName = book.get("generated_image");
        const publicUrl = `/api/files/${book.collection().id}/${book.id}/${fileName}`;
        const fullUrl = `${$app.settings().meta.appUrl}${publicUrl}`;

        console.log(`[QuoteImage/Direct] Basarili: ${fileName}`);

        return c.json(200, {
            image_url: fullUrl
        });

    } catch (err) {
        console.log("[QuoteImage/Direct] Error:", err);
        return c.json(500, { error: err.toString() });
    }
});
