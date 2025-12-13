/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/ai/quote", (c) => {
    console.log("[QuoteAPI] İstek geldi...");

    try {
        // 1. Request Body'den ID al
        const data = c.requestInfo().body;
        const bookId = data.id;

        if (!bookId) {
            return c.json(400, { error: "bookId is required" });
        }

        // 2. Kitabı bul
        const book = $app.findRecordById("books", bookId);
        const title = book.get("title");

        // Yazar parse helper (Byte array fix)
        let author = "";
        const rawAuthors = book.get("authors");
        try {
            function bytesToString(bytes) {
                try { return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes))); }
                catch (e) { return String.fromCharCode.apply(null, bytes); }
            }
            if (Array.isArray(rawAuthors) && rawAuthors.length > 0 && typeof rawAuthors[0] === 'number') {
                author = bytesToString(rawAuthors);
            } else if (Array.isArray(rawAuthors)) {
                author = rawAuthors.join(", ");
            } else {
                author = String(rawAuthors);
            }
        } catch (e) { author = String(rawAuthors); }

        console.log(`[QuoteAPI] Kitap: ${title} - Yazar: ${author}`);

        // 3. Prompt Hazırla
        const promptText = `
            Kitap: "${title}"
            Yazar: "${author}"
            Gorev: Bu kitaptan veya bu kitabin ruhunu yansitan cok etkileyici, derin ve edebi bir alinti (soz) yaz.
            Dil: Sadece TURKCE.
            Kural: Sadece alinti metnini dondur. Tirnak isareti, yazar adi veya ek aciklama ekleme. Sadece saf metin.
        `;

        // 4. Pollinations AI İsteği
        const pollinationKey = $os.getenv("POLLINATION_KEY") || "";
        const encodedPrompt = encodeURIComponent(promptText.trim());
        const url = `https://gen.pollinations.ai/text/${encodedPrompt}?model=nova-micro`;

        const res = $http.send({
            url: url,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${pollinationKey}`,
                "Content-Type": "text/plain"
            },
            timeout: 30
        });

        if (res.statusCode !== 200) {
            return c.json(500, { error: "AI Error", details: res.raw });
        }

        // 5. Yanıtı Temizle
        let quote = res.raw;
        // Bazen AI markdown veya JSON dondurmeye calisabilir, temizleyelim
        quote = quote.replace(/```json/g, "").replace(/```/g, "").replace(/"/g, "").trim();

        console.log(`[QuoteAPI] Uretilen Alinti: ${quote}`);

        // 6. Yanıtı Dön
        return c.json(200, {
            quote: quote,
            book: title
        });

    } catch (err) {
        console.log("[QuoteAPI] Error:", err);
        return c.json(500, { error: err.toString() });
    }
});
