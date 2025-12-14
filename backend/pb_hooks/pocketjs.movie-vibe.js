/// <reference path="../pb_data/types.d.ts" />

console.log("--> Movie Vibe Match Worker (Global Table Mode) Ready...");

cronAdd("movie_vibe_job", "* * * * *", () => {

    // 0. CLEANUP: Timeout check for 'processing' records (> 5 mins) in GLOBAL table
    try {
        const d = new Date();
        d.setMinutes(d.getMinutes() - 5);
        const threshold = d.toISOString().replace('T', ' ').substring(0, 19) + ".000Z";

        const staleRecords = $app.findRecordsByFilter(
            "global_movies",
            `vibe_status = 'processing' && updated < '${threshold}'`,
            "-updated",
            5
        );

        if (staleRecords.length > 0) {
            console.log(`[MovieVibe] Cleaning up ${staleRecords.length} stale global records...`);
            staleRecords.forEach((rec) => {
                rec.set("vibe_status", "failed");
                // ai_notes field might not exist in global_movies schema based on user input, 
                // but usually fine to set if schema allows, or ignore if strict. 
                // We'll try to set it, if it fails it might be ignored or throw.
                // User didn't show ai_notes in global_movies, but it is good practice.
                try { rec.set("ai_notes", "Timeout (Auto-Cleanup)"); } catch (e) { }
                $app.save(rec);
            });
        }
    } catch (err) {
        console.log("[MovieVibe] Cleanup Warning:", err);
    }

    // 1. FIND PENDING IN GLOBAL MOVIES
    try {
        const records = $app.findRecordsByFilter(
            "global_movies",
            "vibe_status = 'pending'",
            "-updated", // Process recently requested ones first? or oldest?
            5
        );

        if (records.length === 0) return;

        console.log(`[MovieVibe] Processing ${records.length} global movies...`);

        records.forEach((record) => {
            const tmdbId = record.get("tmdb_id");
            let title = "";

            // We need the title to run the prompt. 
            // Try to find it from a local movie record since global_movies schema doesn't seem to force title? 
            // Or maybe it does, but let's lookup to be safe/rich.
            try {
                const localMovies = $app.findRecordsByFilter(
                    "movies",
                    `tmdb_id = '${tmdbId}'`,
                    "-created",
                    1
                );
                if (localMovies.length > 0) {
                    title = localMovies[0].get("title");
                }
            } catch (e) { }

            // If we still don't have a title (orphan global record?), we can't do much.
            if (!title) {
                console.log(`[MovieVibe] No title found for tmdb_id ${tmdbId}. Skipping.`);
                record.set("vibe_status", "failed");
                try { record.set("ai_notes", "No title found for TMDB ID"); } catch (e) { }
                $app.save(record);
                return;
            }

            // Mark as processing
            record.set("vibe_status", "processing");
            $app.save(record);

            try {
                // Check if vibes already exist? (Recalculation check)
                // If user set to pending, they probably want a recalc.

                // PROMPT PREPARATION
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
                rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                const firstBrace = rawText.indexOf('{');
                const lastBrace = rawText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    rawText = rawText.substring(firstBrace, lastBrace + 1);
                }
                const aiData = JSON.parse(rawText);

                // UPDATE GLOBAL RECORD
                if (aiData.vibes) record.set("vibes", aiData.vibes);
                if (aiData.mood_color) record.set("mood_color", aiData.mood_color);
                if (aiData.summary) record.set("ai_summary", aiData.summary);

                record.set("vibe_status", "completed");
                try { record.set("ai_notes", ""); } catch (e) { }
                $app.save(record);

                console.log(`[MovieVibe] Success (Global): ${title}`);

            } catch (err) {
                console.log(`[MovieVibe] Error for ${title}: ${err}`);
                record.set("vibe_status", "failed");
                try { record.set("ai_notes", "Error: " + err.toString()); } catch (e) { }
                $app.save(record);
            }
        });

    } catch (e) {
        console.log("[MovieVibe] Main Error:", e);
    }
});
