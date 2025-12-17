/// <reference path="../pb_data/types.d.ts" />

// Router definition
routerAdd("POST", "/api/ai/quote", (c) => {
    // Helper must be defined INSIDE the handler scope for safety in PB Goja
    function utf8ArrayToString(aBytes) {
        var out = "";
        var i = 0;
        var len = aBytes.length;
        while (i < len) {
            var c = aBytes[i++];
            if (c >> 4 < 8) out += String.fromCharCode(c);
            else if (c >> 4 < 14) out += String.fromCharCode(((c & 0x1F) << 6) | (aBytes[i++] & 0x3F));
            else out += String.fromCharCode(((c & 0x0F) << 12) | ((aBytes[i++] & 0x3F) << 6) | ((aBytes[i++] & 0x3F) << 0));
        }
        return out;
    }

    try {
        const data = c.requestInfo().body;
        const bookId = data.id;

        if (!bookId) {
            return c.json(400, { error: "bookId is required" });
        }

        // 1. Fetch Book Info
        const book = $app.findRecordById("books", bookId);

        // 0. CHECK ENRICHMENT STATUS (Dependency)
        // Kullanici istegi: Enrich pending veya processing ise diger AI islemleri engellenmeli
        const enrichmentStatus = book.get("enrichment_status");
        if (enrichmentStatus === "pending" || enrichmentStatus === "processing") {
            return c.json(400, { error: "Kitap özeti/analizi henüz tamamlanmadı. Lütfen bekleyin." });
        }

        const title = book.get("title");
        let author = "";

        try {
            const rawAuthors = book.get("authors");
            if (Array.isArray(rawAuthors) && rawAuthors.length > 0 && typeof rawAuthors[0] === 'number') {
                author = utf8ArrayToString(rawAuthors);
            } else if (Array.isArray(rawAuthors)) {
                author = rawAuthors.join(", ");
            } else {
                author = String(rawAuthors);
            }
        } catch (e) { author = "Unknown Author"; }

        // 2. Check Limit (Max 2 Quotes)
        let history = [];
        try {
            const raw = book.get("generated_content");

            if (raw) {
                // 1. Raw veriyi string'e cevir
                let jsonStr = "";
                try { jsonStr = JSON.stringify(raw); } catch (e) { }

                let temp = null;
                try { temp = JSON.parse(jsonStr); } catch (e) { }

                if (Array.isArray(temp) && temp.length > 0 && typeof temp[0] === 'number') {
                    try {
                        const decodedStr = utf8ArrayToString(temp);
                        history = JSON.parse(decodedStr);
                    } catch (decodeErr) {
                        history = [];
                    }
                } else if (Array.isArray(temp)) {
                    history = temp;
                } else {
                    if (temp) history = [temp];
                }
            }
        } catch (e) {
            history = [];
        }

        if (!Array.isArray(history)) {
            history = [];
        }

        // Clean existing
        history = history.filter(item => typeof item === 'object' && item !== null && item.id);

        if (history.length >= 2) {
            return c.json(400, { error: "Bu kitap için maksimum 2 alıntı oluşturabilirsiniz." });
        }

        // 3. Prepare AI Request
        const seed = Math.floor(Math.random() * 1000000);
        const promptText = `
            Role: Senior Turkish Literary Editor & Cinematic Art Director.
            Input Data: Book: "${title}" by ${author} | Seed: ${seed}

            Directives:

            1. THE QUOTE (Turkish):
            - Select the most iconic, profound, or emotionally resonant quote from this book.
            - TRANSLATION PROTOCOL: Do NOT translate literally word-for-word. Use "Semantic Localization".
            - The Turkish output must flow naturally, using perfect grammar and literary vocabulary (Istanbul Turkish).
            - It must sound like it was originally written in Turkish by a master author. Avoid robotic phrasing.
            - Length: Short, punchy, shareable (Max 45 words).
            - If the book is originally Turkish, use the exact original text.

            2. THE VISUAL (English):
            - Create a prompt for an AI image generator.
            - Style: Minimalist, cinematic, moody, high-end editorial photography.
            - Focus: Symbolic objects, lighting, and texture that represent the book's core theme.
            - NO TEXT inside the image description.

            3. OUTPUT FORMAT:
            - Return STRICT JSON. No markdown formatting, no intro/outro.

            {
            "quote": "The polished Turkish quote string",
            "imagePrompt": "The visual description string"
            }
        `;

        const pollinationKey = $os.getenv("POLLINATION_KEY") || "";
        const encodedPrompt = encodeURIComponent(promptText.trim());
        const url = `https://gen.pollinations.ai/text/${encodedPrompt}?model=openai-fast&seed=${seed}&t=${new Date().getTime()}`;

        const res = $http.send({
            url: url,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${pollinationKey}`,
                "Content-Type": "application/json"
            },
            timeout: 45
        });

        if (res.statusCode !== 200) {
            return c.json(500, { error: "AI Error", details: res.raw });
        }

        // 3. Parse Response
        let rawText = res.raw;
        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        let result = {};

        try {
            const firstBrace = rawText.indexOf('{');
            const lastBrace = rawText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                rawText = rawText.substring(firstBrace, lastBrace + 1);
            }
            result = JSON.parse(rawText);
        } catch (e) {
            result = {
                quote: rawText.substring(0, 100) + "...",
                imagePrompt: `Aesthetic book photography of ${title}, cinematic lighting`
            };
        }

        // 4. Save to DB
        const newId = $security.randomString(10);
        const newItem = {
            id: newId,
            quote: result.quote,
            imagePrompt: result.imagePrompt,
            createdAt: new Date().toISOString()
        };

        // Append to existing history (parsed at step 2)
        history.push(newItem);

        try {
            book.set("generated_content", history);
            $app.save(book);
        } catch (saveError) {
            throw new Error("DB Save Error: " + saveError.toString());
        }

        return c.json(200, {
            quote: newItem.quote,
            imagePrompt: newItem.imagePrompt,
            newItem: newItem
        });

    } catch (err) {
        return c.json(500, { error: err.toString(), details: err.message });
    }
});
