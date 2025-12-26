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
        You are a highly-trained Literary Librarian and Senior Editor with a vast knowledge of published literature worldwide. Your task is to provide 3 REAL book recommendations based on user sentiment, request, or vague descriptions.

        ### INPUT
        User Request: "${userQuery}"

        ### HALLUCINATION PREVENTION (ZERO TOLERANCE)
        1. **REALITY CHECK**: You MUST NOT provide titles of books that do not exist. Do not "combine" titles or authors.
        2. **TRANSLATION RULE**: 
           - If a book has an OFFICIAL Turkish translation/edition, use the Turkish title.
           - If a book has NOT been officially translated to Turkish, keep the 'title' in its Original Language (usually English). 
           - NEVER invent or guess a Turkish title for a book that hasn't been published in Turkey.
        3. **ISBN ACCURACY**: Only provide an ISBN-13 if you are 100% sure. If not, use null.
        4. **UNICITY**: Recommend exactly 3 distinct books.

        ### EXAMPLES OF HIGH-QUALITY RECOMMENDATIONS
        User: "Sürükleyici bir polisiye ama içinde aşk olmasın"
        Response: {
          "recommendations": [
            {
              "title": "On Küçük Zenci", // (Official Turkish Title for 'And Then There Were None')
              "author": "Agatha Christie",
              ...
            },
            {
              "title": "Project Hail Mary", // (Keeping original if it's the best fit and no TR title available)
              "author": "Andy Weir",
              ...
            }
          ]
        }

        ### CONSTRAINTS
        1. **TOPIC VERIFICATION**: Use a strict filter. If the request is generic chat (e.g. "hi", "how are you") or completely unrelated to books/reading, return the OFF_TOPIC JSON.
        2. **STRICT JSON**: Output must be a pure JSON object. No markdown wrappers.
        3. **LANGUAGE**: 'reason' and 'summary' must ALWAYS be in TURKISH, even if the book title is in English. Explain why the English book fits the Turkish request.
        4. **METADATA**: Authors should be in their most common international form.

        ### JSON STRUCTURE (Success)
        {
          "recommendations": [
            {
              "title": "String",
              "author": "String",
              "isbn": "String_or_null",
              "reason": "String (Turkish)",
              "summary": "String (Turkish)"
            }
          ]
        }

        ### JSON STRUCTURE (Off-Topic)
        {
          "error": "OFF_TOPIC",
          "message": "Üzgünüm, şu an sadece kitap önerileri konusunda yardımcı olabilirim. Lütfen okuma listenize eklemek istediğiniz bir tarz veya konu belirtin."
        }

        ### FINAL VERIFICATION LOOP
        1. Did I invent any of these books? (If yes, replace them)
        2. Is the response valid JSON?
        3. Is the language correct?
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
        const models = ["openai", "gemini-search", "openai-fast"];
        let lastError = null;

        for (const model of models) {
            try {
                // console.log(`[Recommend] Trying model: ${model}...`);
                res = fetchWithModel(model);
                if (res.statusCode === 200) {
                    // console.log(`[Recommend] Success with ${model}`);
                    break;
                }
                throw new Error("Status " + res.statusCode);
            } catch (e) {
                console.log(`[Recommend] Model ${model} failed: ${e.message}`);
                lastError = e;
                res = null;
            }
        }

        if (!res || res.statusCode !== 200) {
            throw new Error("All AI providers failed. Last Error: " + (lastError ? lastError.message : "None"));
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