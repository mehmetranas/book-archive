/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/ai/quote", (c) => {
    console.log("[QuoteAPI] İstek geldi (JSON Mode)...");

    try {
        const data = c.requestInfo().body;
        const bookId = data.id;

        if (!bookId) {
            return c.json(400, { error: "bookId is required" });
        }

        // 1. Kitap Bilgilerini Al
        const book = $app.findRecordById("books", bookId);
        const title = book.get("title");

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

        console.log(`[QuoteAPI] Kitap: ${title}`);

        const seed = Math.floor(Math.random() * 100000);

        // 2. Prompt Hazırla (Hem Alıntı Hem Görsel Promptu)
        const promptText = `
            Book: "${title}", Author: "${author}"
            Random Seed: ${seed}
            
            Task:
            1. Select a RANDOM, profound, iconic quote from this book in TURKISH. It should be different from previous generations if possible.
            2. Create a detailed image generation prompt in ENGLISH. This prompt should describe the visual mood, setting, and atmosphere of the selected quote for an Instagram post (cinematic, photorealistic, no text).
            
            Return strictly in JSON format:
            {
              "quote": "The quote in Turkish...",
              "imagePrompt": "A detailed cinematic description of the scene in English..."
            }
            
            Rule: Return ONLY valid JSON. No markdown formatting.
        `;

        const pollinationKey = $os.getenv("POLLINATION_KEY") || "";
        const encodedPrompt = encodeURIComponent(promptText.trim());
        const url = `https://gen.pollinations.ai/text/${encodedPrompt}?model=nova-micro&seed=${seed}&t=${new Date().getTime()}`; // Cache busting

        const res = $http.send({
            url: url,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${pollinationKey}`, // Opsiyonel
                "Content-Type": "application/json"
            },
            timeout: 45
        });

        if (res.statusCode !== 200) {
            return c.json(500, { error: "AI Error", details: res.raw });
        }

        // 3. Yanıtı Parse Et
        // 3. Yanıtı Parse Et
        let rawText = res.raw;
        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

        let result;
        try {
            const firstBrace = rawText.indexOf('{');
            const lastBrace = rawText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                rawText = rawText.substring(firstBrace, lastBrace + 1);
            }
            result = JSON.parse(rawText);
        } catch (e) {
            console.log("JSON Parse Hatasi, Raw:", rawText);
            result = {
                quote: rawText.substring(0, 100) + "...",
                imagePrompt: `Aesthetic book photography of ${title}, cinematic lighting`
            };
        }

        // --- DB KAYIT ---
        const newId = $security.randomString(10);
        const newItem = {
            id: newId,
            quote: result.quote,
            imagePrompt: result.imagePrompt,
            createdAt: new Date().toISOString()
        };

        // Mevcut listeyi guvenli sekilde al
        let history = [];
        try {
            const raw = book.get("generated_content");
            if (raw) {
                // Eger raw bir array ise ve ici sayi doluysa (byte array), stringe cevir
                if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'number') {
                    // Byte array to string
                    const str = String.fromCharCode.apply(null, raw); // Basit karakter donusumu
                    try { history = JSON.parse(str); } catch (e) { history = []; }
                }
                // Eger normal bir JS array veya object ise
                else {
                    history = JSON.parse(JSON.stringify(raw));
                }
            }
        } catch (e) {
            console.log("History read error:", e);
            history = [];
        }

        if (!Array.isArray(history)) history = [];

        // Hatalı veri temizligi (sayilar veya bozuk objeler varsa temizle)
        history = history.filter(item => typeof item === 'object' && item !== null && item.id);

        history.push(newItem);

        try {
            book.set("generated_content", history);
            $app.save(book);
            console.log(`[QuoteAPI] Saved new quote. ID: ${newId}`);
        } catch (saveError) {
            throw new Error("DB Save Error: " + saveError.toString());
        }

        return c.json(200, {
            quote: newItem.quote,
            imagePrompt: newItem.imagePrompt,
            newItem: newItem
        });

    } catch (err) {
        console.log("[QuoteAPI] Error:", err);
        return c.json(500, { error: err.toString() });
    }
});
