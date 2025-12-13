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

        // 2. Prepare AI Request
        const seed = Math.floor(Math.random() * 1000000);
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
        const url = `https://gen.pollinations.ai/text/${encodedPrompt}?model=gemini-search&seed=${seed}&t=${new Date().getTime()}`;

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

        // Mevcut listeyi guvenli sekilde al
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

        // Clean
        history = history.filter(item => typeof item === 'object' && item !== null && item.id);

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
