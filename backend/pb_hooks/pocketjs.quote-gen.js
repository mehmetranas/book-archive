/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/ai/quote", (c) => {
    // -------------------------------------------------------------------------
    // 0. HELPER FUNCTIONS
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // 1. DATA EXTRACTION & AUTH
    // -------------------------------------------------------------------------
    let bookId;
    let authData;

    try {
        const info = c.requestInfo();
        const data = info.body || {};
        bookId = data.id;
        authData = info.auth;
    } catch (e) {
        return c.json(400, { error: "Invalid request" });
    }

    if (!bookId) {
        return c.json(400, { error: "bookId is required" });
    }

    if (!authData) {
        return c.json(401, { error: "Authentication required" });
    }

    const pollinationKey = $os.getenv("POLLINATION_KEY");
    if (!pollinationKey) {
        return c.json(500, { error: "Server misconfiguration: POLLINATION_KEY missing" });
    }

    // -------------------------------------------------------------------------
    // 2. USER & CREDIT CHECK
    // -------------------------------------------------------------------------
    let userRecord;
    try {
        const userId = authData.id || authData.getId();
        userRecord = $app.findRecordById("users", userId);

        if (userRecord.getInt("credits") < 1) {
            return c.json(402, {
                error: "INSUFFICIENT_CREDITS",
                message: "Yetersiz bakiye. Devam etmek için kredi yükleyin."
            });
        }
    } catch (err) {
        return c.json(500, { error: "User validation failed: " + err.message });
    }

    // -------------------------------------------------------------------------
    // 3. BOOK VALIDATION
    // -------------------------------------------------------------------------
    let book;
    let title = "";
    let author = "";

    try {
        book = $app.findRecordById("books", bookId);
        title = book.get("title");

        // Parse Author
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

    } catch (e) {
        return c.json(404, { error: "Book not found" });
    }

    // Check existing quotes limit
    let history = [];
    try {
        const raw = book.get("generated_content");
        if (raw) {
            let jsonStr = "";
            try { jsonStr = JSON.stringify(raw); } catch (e) { }
            let temp = null;
            try { temp = JSON.parse(jsonStr); } catch (e) { }

            if (Array.isArray(temp) && temp.length > 0 && typeof temp[0] === 'number') {
                try {
                    const decodedStr = utf8ArrayToString(temp);
                    history = JSON.parse(decodedStr);
                } catch (decodeErr) { history = []; }
            } else if (Array.isArray(temp)) {
                history = temp;
            } else {
                if (temp) history = [temp];
            }
        }
    } catch (e) { history = []; }

    if (!Array.isArray(history)) history = [];
    history = history.filter(item => typeof item === 'object' && item !== null && item.id);

    if (history.length >= 2) {
        return c.json(400, { error: "Bu kitap için maksimum 2 alıntı oluşturabilirsiniz." });
    }

    // -------------------------------------------------------------------------
    // 4. AI REQUEST
    // -------------------------------------------------------------------------
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

    const fetchWithModel = (model) => {
        const encodedPrompt = encodeURIComponent(promptText.trim());
        const url = `https://gen.pollinations.ai/text/${encodedPrompt}?model=${model}&seed=${seed}&json=true`;

        return $http.send({
            url: url,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${pollinationKey}`,
                "Content-Type": "application/json"
            },
            timeout: 60
        });
    };

    let result = {};

    try {
        let res;
        // Try Gemini First
        try {
            res = fetchWithModel("gemini-search");
            if (res.statusCode !== 200) throw new Error("Status " + res.statusCode);
        } catch (primaryErr) {
            console.log("[Quote] Fallback to openai-fast");
            res = fetchWithModel("openai-fast");
        }

        if (res.statusCode !== 200) {
            throw new Error("AI Provider Error: " + res.raw);
        }

        let rawText = res.raw.trim();
        rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            rawText = rawText.substring(firstBrace, lastBrace + 1);
        }

        result = JSON.parse(rawText);

    } catch (err) {
        return c.json(502, { error: "AI Processing Failed: " + err.message });
    }

    // -------------------------------------------------------------------------
    // 5. UPDATE DB & DEDUCT CREDITS
    // -------------------------------------------------------------------------
    try {
        // 5.1 Save new quote to Book
        const newId = $security.randomString(10);
        const newItem = {
            id: newId,
            quote: result.quote,
            imagePrompt: result.imagePrompt,
            createdAt: new Date().toISOString()
        };
        history.push(newItem);
        book.set("generated_content", history);
        $app.save(book);

        // 5.2 Deduct Credit form User
        const currentCredits = userRecord.getInt("credits");
        userRecord.set("credits", currentCredits - 1);
        $app.save(userRecord);

        // 5.3 Return Response
        return c.json(200, {
            quote: newItem.quote,
            imagePrompt: newItem.imagePrompt,
            newItem: newItem,
            remainingCredits: currentCredits - 1
        });

    } catch (saveError) {
        // If saving fails, we might have inconsistent state (book saved, credit not deducted, or vice versa)
        // Ideally we would use a transaction, but simple implementation:
        return c.json(500, { error: "DB Save Error: " + saveError.message });
    }
});
