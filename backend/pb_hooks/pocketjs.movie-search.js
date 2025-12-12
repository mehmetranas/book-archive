/// <reference path="../pb_data/types.d.ts" />

console.log("--> Movie Search API (TMDB) Hazir...");

routerAdd("GET", "/api/movie_search", (c) => {
    try {
        let query = "";

        // Deneme 1: Standard Echo
        try { if (c.queryParam) query = c.queryParam("q"); } catch (e) { }

        // Deneme 2: Request Object
        if (!query) {
            try {
                const req = (typeof c.request === 'function') ? c.request() : c.request;
                if (req && req.url) {
                    const url = req.url;
                    if (url.query && typeof url.query === 'function') {
                        query = url.query().get("q");
                    } else if (url.rawQuery) {
                        const parts = url.rawQuery.split('&');
                        for (const p of parts) {
                            const pair = p.split('=');
                            if (pair[0] === 'q') {
                                query = decodeURIComponent(pair[1] || '').replace(/\+/g, ' ');
                                break;
                            }
                        }
                    }
                }
            } catch (e) { console.log("Deneme 2 hatasi:", e); }
        }

        console.log("[MovieSearch] Gelen Sorgu:", query);

        if (!query) {
            return c.json(400, { error: "Parametre 'q' (film adi) eksik." });
        }

        const apiKey = $os.getenv("TMDB_API_KEY");
        if (!apiKey) {
            console.log("[MovieSearch] Hata: TMDB_API_KEY env tanimli degil.");
            return c.json(500, { error: "Sunucu hatasi: API Key eksik." });
        }

        // TMDB Search Movie Endpoint
        // Dil destegi icin &language=tr-TR eklenebilir.
        const safeQuery = query.replace(/ /g, "%20");
        const apiUrl = "https://api.themoviedb.org/3/search/movie?api_key=" + apiKey + "&query=" + safeQuery + "&language=tr-TR&page=1&include_adult=false";

        console.log("[MovieSearch] URL:", apiUrl);

        const res = $http.send({
            url: apiUrl,
            method: "GET",
            headers: { "Content-Type": "application/json" },
            timeout: 10
        });

        if (res.statusCode !== 200) {
            return c.json(res.statusCode, {
                error: "TMDB API Hatasi",
                upstream_code: res.statusCode,
                raw: res.raw
            });
        }

        const data = res.json;
        // Client'a sonuclari donelim
        return c.json(200, data.results || []);

    } catch (err) {
        console.log("[MovieSearch] Exception:", err);
        return c.json(500, { error: "Beklenmeyen Sunucu Hatasi", details: err.toString() });
    }
});
