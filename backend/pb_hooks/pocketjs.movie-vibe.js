/// <reference path="../pb_data/types.d.ts" />

console.log("--> Movie Vibe Match Worker (Mood Analysis) Ready...");

cronAdd("movie_vibe_job", "* * * * *", () => {

    // 0. CLEANUP: Timeout check for 'processing' records (> 5 mins)
    try {
        const d = new Date();
        d.setMinutes(d.getMinutes() - 5);
        const threshold = d.toISOString().replace('T', ' ').substring(0, 19) + ".000Z";

        const staleRecords = $app.findRecordsByFilter(
            "movies",
            `vibe_status = 'processing' && updated < '${threshold}'`,
            "-updated",
            5
        );

        if (staleRecords.length > 0) {
            console.log(`[MovieVibe] Cleaning up ${staleRecords.length} stale records...`);
            staleRecords.forEach((rec) => {
                // If it timed out, mark as failed to avoid infinite loop/cost
                rec.set("vibe_status", "failed");
                rec.set("ai_notes", "Timeout (Auto-Cleanup)");
                $app.save(rec);
            });
        }
    } catch (err) {
        console.log("[MovieVibe] Cleanup Warning:", err);
    }

    // 1. FIND PENDING
    try {
        const records = $app.findRecordsByFilter(
            "movies",
            "vibe_status = 'pending'",
            "-created",
            5
        );

        if (records.length === 0) return;

        console.log(`[MovieVibe] Processing ${records.length} movies...`);

        records.forEach((record) => {
            const title = record.get("title");

            // Mark as processing immediately
            record.set("vibe_status", "processing");
            $app.save(record);

            try {
                // SAFETY: Check if already analyzed to save AI costs
                const existingVibes = record.get("vibes");
                // Check if vibes field is populated (array with items or non-empty string depending on storage)
                // Since we store as JSON, it comes out as array or object.
                let hasData = false;
                try {
                    // PocketBase might return raw JSON or object. 
                    // If it's an array with length > 0, we skip.
                    if (Array.isArray(existingVibes) && existingVibes.length > 0) hasData = true;
                } catch (e) { }

                if (hasData) {
                    console.log(`[MovieVibe] Skipping ${title} - Already has data.`);
                    record.set("vibe_status", "completed");
                    $app.save(record);
                    return;
                }

                // PROMPT PREPARATION (English Prompt, Turkish Output)
                const promptText = `
                    Role: Professional Film Critic & Atmosphere Colorist.
                    Task: Analyze the vibe, mood, and aesthetic of the movie: "${title}".
                    
                    Output Requirement (JSON only):
                    1. "vibes": A list of 3-5 short, punchy tags describing the mood in TURKISH (e.g., "Gerilim", "Melankolik", "Neon-Noir").
                    2. "mood_color": A single HEX color code representing the movie's dominant visual atmosphere or feeling.
                    3. "summary": A 2-sentence atmospheric summary in TURKISH. Focus on how it feels to watch, not just the plot.

                    Example Output:
                    {
                        "vibes": ["Distopik", "Siberpunk", "Yalnızlık"],
                        "mood_color": "#F5C2B4",
                        "summary": "İnsanlığın ne olduğunu sorgulayan, görsel olarak büyüleyici ama ruhsal olarak ağır bir yolculuk."
                    }

                    CONSTRAINTS:
                    - Valid JSON format only.
                    - No Markdown.
                    - Vibes and Summary must be in TURKISH.
                `;

                // POLLINATIONS AI REQUEST
                const pollinationKey = $os.getenv("POLLINATION_KEY") || "";
                const encodedPrompt = encodeURIComponent(promptText);
                // Using a fast text model
                const url = `https://gen.pollinations.ai/text/${encodedPrompt}?model=openai`;

                const res = $http.send({
                    url: url,
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${pollinationKey}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 60
                });

                if (res.statusCode !== 200) throw new Error("AI Status: " + res.statusCode);

                // PARSE RESPONSE
                let rawText = res.raw;
                // Cleanup potentially messy AI output
                rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                const firstBrace = rawText.indexOf('{');
                const lastBrace = rawText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    rawText = rawText.substring(firstBrace, lastBrace + 1);
                }

                const aiData = JSON.parse(rawText);

                // UPDATE RECORD
                if (aiData.vibes) record.set("vibes", aiData.vibes);
                if (aiData.mood_color) record.set("mood_color", aiData.mood_color);

                // If there's a specific field for AI summary, use it. 
                // Assuming 'ai_summary' or putting it in description if empty? 
                // Let's use 'ai_summary' field if exists, but since we are defining the feature, 
                // I'll assume we save it to 'ai_summary'.
                if (aiData.summary) record.set("ai_summary", aiData.summary);

                record.set("vibe_status", "completed");
                $app.save(record);

                console.log(`[MovieVibe] Success: ${title}`);

            } catch (err) {
                console.log(`[MovieVibe] Error for ${title}: ${err}`);
                // FAILED state - No automatic retry to save cost/performance as requested
                record.set("vibe_status", "failed");
                record.set("ai_notes", "Error: " + err.toString());
                $app.save(record);
            }
        });

    } catch (e) {
        console.log("[MovieVibe] Main Error:", e);
    }
});
