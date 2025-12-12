/// <reference path="../pb_data/types.d.ts" />

console.log("--> TMDB Proxy API Hazir...");

routerAdd("GET", "/api/tmdb", (c) => {
    // Manuel Auth Kontrolü
    const authRecord = c.get("authRecord");
    if (!authRecord) {
        return c.json(403, { error: "Yetkisiz erişim. Lutfen giris yapiniz." });
    }

    try {
        // En saglam query parametre okuma yontemi (Goja/PocketBase uyumlu)
        const getQueryParam = (key) => {
            try { return c.queryParam(key); } catch (e) { }
            try {
                const req = (typeof c.request === 'function') ? c.request() : c.request;
                if (req && req.url && req.url.query) return req.url.query().get(key);
            } catch (e) { }
            return null;
        };

        const path = getQueryParam("path");
        if (!path) {
            return c.json(400, { error: "Parametre 'path' eksik. Ornek: ?path=/search/movie" });
        }

        const apiKey = $os.getenv("TMDB_API_KEY");
        if (!apiKey) {
            return c.json(500, { error: "Sunucu hatasi: TMDB_API_KEY eksik." });
        }

        // PocketBase request query string'ini alip TMDB'ye iletmek icin parse edelim
        // Ancak 'path' parametresini cikarmamiz lazim.
        let forwardQuery = "";
        try {
            const req = (typeof c.request === 'function') ? c.request() : c.request;
            if (req && req.url && req.url.rawQuery) {
                const parts = req.url.rawQuery.split('&');
                const filteredParts = parts.filter(p => !p.startsWith("path="));
                if (filteredParts.length > 0) {
                    forwardQuery = "&" + filteredParts.join('&');
                }
            }
        } catch (e) { console.log("Query parsing error:", e); }

        // Varsayilan dil TR olsun, eger client gondermediyse
        if (!forwardQuery.includes("language=")) {
            forwardQuery += "&language=tr-TR";
        }

        const apiUrl = "https://api.themoviedb.org/3" + path + "?api_key=" + apiKey + forwardQuery;

        // console.log("[TMDB Proxy] URL:", apiUrl);

        const res = $http.send({
            url: apiUrl,
            method: "GET",
            headers: { "Content-Type": "application/json" },
            timeout: 10
        });

        if (res.statusCode >= 400) {
            return c.json(res.statusCode, {
                error: "TMDB Upstream Error",
                upstream_code: res.statusCode,
                details: res.json || res.raw
            });
        }

        return c.json(200, res.json);

    } catch (err) {
        console.log("[TMDB Proxy] Exception:", err);
        return c.json(500, { error: "Proxy Hatasi", details: err.toString() });
    }
});
