/// <reference path="../pb_data/types.d.ts" />

console.log("--> Movie Character Map Worker (Global Graph) Ready...");

cronAdd("movie_charmap_job", "* * * * *", () => {

    // 0. CLEANUP: Timeout check for 'processing' records (> 10 mins)
    try {
        const d = new Date();
        d.setMinutes(d.getMinutes() - 10);
        const threshold = d.toISOString().replace('T', ' ').substring(0, 19) + ".000Z";

        // CLEANUP: Target global_movies
        const staleRecords = $app.findRecordsByFilter(
            "global_movies",
            `character_map_status = 'processing' && updated < '${threshold}'`,
            "-updated",
            5
        );

        if (staleRecords.length > 0) {
            console.log(`[MovieCharMap] Cleaning up ${staleRecords.length} stale global records...`);
            staleRecords.forEach((rec) => {
                rec.set("character_map_status", "failed");
                // rec.set("ai_notes", "Timeout (Auto-Cleanup)"); // global_movies table likely doesn't have ai_notes, check schema if needed. Assuming it uses ai_summary or log.
                $app.save(rec);
            });
        }
    } catch (err) {
        console.log("[MovieCharMap] Cleanup Warning:", err);
    }

    // 1. FIND PENDING GLOBAL TASKS
    try {
        const records = $app.findRecordsByFilter(
            "global_movies",
            "character_map_status = 'pending'",
            "-updated",
            5
        );

        if (records.length === 0) return;

        console.log(`[MovieCharMap] Processing ${records.length} global movies...`);

        records.forEach((record) => {
            // NOTE: record is now a 'global_movies' record
            const tmdbId = record.get("tmdb_id");
            let title = record.get("title"); // Might be empty if schema implies no title

            // Fallback: If no title in global record, find it from local movies
            if (!title) {
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
                } catch (e) {
                    console.log("[MovieCharMap] Could not find local title fallback: " + e);
                }
            }

            if (!title) {
                console.log(`[MovieCharMap] No title found for tmdb_id ${tmdbId}. Skipping.`);
                record.set("character_map_status", "failed");
                $app.save(record);
                return;
            }

            // Mark as processing
            record.set("character_map_status", "processing");
            $app.save(record);

            try {
                // STEP 1: Generate AI Data
                // PROMPT FOR GRAPH DATA
                const promptText = `
                    Role: Cinema Psychologist & Data Scientist.
                    Task: Create a character relationship network (graph) for the movie: "${title}".
                    Language: TURKISH.

                    Output Requirements (Strict JSON):
                    A JSON object with two arrays: "nodes" and "links".

                    1. "nodes": Array of main characters.
                       - id: Character Name (Unique)
                       - group: "Protagonist" | "Antagonist" | "Sidekick" | "Neutral"
                       - bio: Short 1-sentence bio in TURKISH.

                    2. "links": Array of relationships.
                       - source: Character Name (must match an id in nodes)
                       - target: Character Name (must match an id in nodes)
                       - type: "Love" | "Enemy" | "Family" | "Friends" | "Business" | "Rivalry"
                       - label: Short definition in TURKISH (e.g., "Aşık", "Kardeş", "İhanet Etti")

                    Example Output:
                    {
                      "nodes": [
                        {"id": "Neo", "group": "Protagonist", "bio": "Seçilmiş kişi."},
                        {"id": "Ajan Smith", "group": "Antagonist", "bio": "Sistem ajanı."}
                      ],
                      "links": [
                        {"source": "Neo", "target": "Ajan Smith", "type": "Enemy", "label": "Ezeli Düşman"}
                      ]
                    }

                    CONSTRAINTS:
                    - JSON ONLY. No markdown.
                    - Nodes must cover at least the main cast.
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
                    timeout: 120
                });

                if (res.statusCode !== 200) throw new Error("AI Status: " + res.statusCode);

                // PARSE RESPONSE
                let rawText = res.raw;
                rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                const start = rawText.indexOf('{');
                const end = rawText.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    rawText = rawText.substring(start, end + 1);
                }
                const graphData = JSON.parse(rawText);

                // STEP 2: Save to Global Movie
                record.set("character_map", graphData);
                record.set("character_map_status", "completed");

                // Assuming 'ai_summary' field exists in global_movies for notes/summary if needed, 
                // but strictly for character map we just set status and map.

                $app.save(record);

                console.log(`[MovieCharMap] Success (Global Data Updated): ${title}`);

            } catch (err) {
                console.log(`[MovieCharMap] Error for ${title}: ${err}`);
                record.set("character_map_status", "failed");
                // record.set("ai_notes", "Error: " + err.toString()); // check if global_movies has this field before uncommenting
                $app.save(record);
            }
        });

    } catch (e) {
        console.log("[MovieCharMap] Main Error:", e);
    }
});
