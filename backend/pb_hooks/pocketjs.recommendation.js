/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/ai/recommend-books", (c) => {
    // -------------------------------------------------------------------------
    // 1. DATA EXTRACTION & VALIDATION
    // -------------------------------------------------------------------------
    let userQuery = "";
    let authData = null; // Can be a Record model or a plain info object

    try {
        const info = c.requestInfo();
        const data = info.body || {};
        userQuery = data.query;

        // Use requestInfo().auth as it's the proven reliable source in this setup
        authData = info.auth;
    } catch (e) {
        return c.json(400, { error: "Invalid request body or server error" });
    }

    if (!userQuery || userQuery.length < 5) {
        return c.json(400, { error: "Query too short" });
    }

    const pollinationKey = $os.getenv("POLLINATION_KEY");
    if (!pollinationKey) {
        return c.json(500, { error: "Server misconfiguration: POLLINATION_KEY missing" });
    }

    if (!authData) {
        return c.json(401, { error: "Authentication required" });
    }

    // -------------------------------------------------------------------------
    // 2. USER RECORD & CREDIT CHECK
    // -------------------------------------------------------------------------
    let userRecord;
    try {
        // We always fetch the fresh record from DB to ensure transactional safety for credits
        // authData.id is available since info.auth contains the user schema
        const userId = authData.id || authData.getId();

        // FIX: Use $app direct methods as observed in other working hooks, 
        // avoiding 'Object has no member dao' error.
        userRecord = $app.findRecordById("users", userId);

        if (userRecord.getInt("credits") < 1) {
            return c.json(402, {
                error: "INSUFFICIENT_CREDITS",
                message: "Yetersiz bakiye. Devam etmek için kredi yükleyin."
            });
        }
    } catch (err) {
        // If user not found in DB or DAO error
        return c.json(500, { error: "User validation failed: " + err.message });
    }

    // -------------------------------------------------------------------------
    // 3. AI PROMPT PREPARATION
    // -------------------------------------------------------------------------
    const prompt = `
        ### ROLE
        You are a Literary Concierge and Expert Librarian AI. Your goal is to recommend books based on a user's free-text request.

        ### INPUT
        User Request: "${userQuery}"

        ### CONSTRAINTS
        1. **OFF-TOPIC CHECK**: If the user's request is NOT about finding a book (e.g., asking about coding, politics, recipes, general chat, or movies without a book context), return a JSON with "error": "OFF_TOPIC". Do NOT recommend anything.
        2. **STRICT JSON**: Output must be a SINGLE valid JSON object. No markdown, no preambles.
        3. **LANGUAGE**: The 'reason' and 'summary' fields MUST be in TURKISH.
        4. **QUANTITY**: Recommend exactly 3 books.

        ### JSON STRUCTURE (Success)
        {
        "recommendations": [
            {
            "title": "Exact Book Title",
            "author": "Author Name",
            "isbn": "9781234567890", // Best guess ISBN-13 if known, else null
            "reason": "Expert explanation of why this fits the request (in Turkish).",
            "summary": "Short plot summary (in Turkish)."
            }
        ]
        }

        ### JSON STRUCTURE (Off-Topic)
        {
        "error": "OFF_TOPIC",
        "message": "Üzgünüm, sadece kitap önerileri konusunda yardımcı olabilirim."
        }

        ### FINAL VERIFICATION & SANITY CHECK (CRITICAL)
        Before outputting the final JSON, perform this internal "Self-Correction" loop:
        1. **Analyze Intent:** Did the user specifically ask for a *book*, *reading material*, *novel*, or *literature*?
          - If the user asked for a "movie", "song", or "code snippet", this is OFF_TOPIC.
        2. **Verify Output:** Are the items you selected actually published books? Ensure they are not movies or video games with the same name.
        3. **Decision Gate:**
          - IF the input is even slightly irrelevant to reading/books -> Force the "OFF_TOPIC" JSON.
          - ONLY IF the input is confirmed to be a book request -> Output the "recommendations" JSON. 
    `;

    // -------------------------------------------------------------------------
    // 4. AI API CALL
    // -------------------------------------------------------------------------
    const fetchWithModel = (model) => {
        const encodedPrompt = encodeURIComponent(prompt.trim());
        const seed = Math.floor(Math.random() * 1000000);
        // Using json=true for better stability with compatible models
        const url = `https://text.pollinations.ai/${encodedPrompt}?model=${model}&seed=${seed}&json=true`;

        return $http.send({
            url: url,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${pollinationKey}`,
                "Content-Type": "application/json"
            },
            timeout: 60 // 1 minute timeout
        });
    };

    let res;
    let jsonResponse;

    try {
        // Attempt 1: Gemini
        try {
            res = fetchWithModel("gemini-search");
            if (res.statusCode !== 200) throw new Error("Status " + res.statusCode);
        } catch (primaryError) {
            console.log("[Recommend] Gemini failed, trying fallback:", primaryError.message);
            // Attempt 2: OpenAI Fast
            res = fetchWithModel("openai-fast");
            if (res.statusCode !== 200) {
                throw new Error("AI Provider Error: " + res.raw);
            }
        }

        // Parsing
        let rawText = res.raw.trim();
        // Remove markdown code blocks if present
        rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            rawText = rawText.substring(firstBrace, lastBrace + 1);
        }

        jsonResponse = JSON.parse(rawText);

    } catch (err) {
        return c.json(502, { error: "AI Processing Failed: " + err.message });
    }

    // -------------------------------------------------------------------------
    // 5. CREDIT DEDUCTION (ON SUCCESS)
    // -------------------------------------------------------------------------
    // Only deduct if we got valid recommendations (not off-topic error)
    if (jsonResponse.recommendations && Array.isArray(jsonResponse.recommendations)) {
        try {
            const currentCredits = userRecord.getInt("credits");
            const newCredits = currentCredits - 1;

            userRecord.set("credits", newCredits);
            $app.save(userRecord); // FIX: Direct save on $app

            // Allow frontend to update UI immediately
            jsonResponse.remainingCredits = newCredits;
        } catch (dbErr) {
            console.log("[Recommend] Credit deduction failed:", dbErr);
            // We don't fail the request here, user gets the result but maybe free of charge due to error
        }
    }

    return c.json(200, jsonResponse);
});