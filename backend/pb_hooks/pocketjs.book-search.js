/// <reference path="../pb_data/types.d.ts" />

console.log("--> Book Search API (Google Books) Hazir (Safe Auth Mode)...");

routerAdd("GET", "/api/book_search", (c) => {

    // --- MANUEL TOKEN DOGRULAMA V2 ---
    try {
        const req = (typeof c.request === 'function') ? c.request() : c.request;
        const authHeader = req.header.get("Authorization");

        if (!authHeader) {
            const autoUser = c.get("authRecord");
            if (!autoUser) {
                return c.json(403, { error: "Yetkisiz erişim. Authorization header eksik." });
            }
        } else {
            const token = authHeader.replace("Bearer ", "").trim();
            if (token) {
                try {
                    $app.dao().findAuthRecordByToken(token, "users");
                } catch (e) {
                    return c.json(403, { error: "Gecersiz token." });
                }
            }
        }
    } catch (err) {
        console.log("Auth Check Error:", err);
        return c.json(500, { error: "Auth kontrol hatasi", details: err.toString() });
    }
    // ----------------------------------

    try {
        let query = "";
        try { if (c.queryParam) query = c.queryParam("q"); } catch (e) { }

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

        console.log("[BookSearch] Gelen Sorgu:", query);

        if (!query) {
            return c.json(400, {
                error: "Parametre 'q' eksik.",
                debug_keys: Object.keys(c)
            });
        }

        const apiKey = $os.getenv("GOOGLE_BOOKS_KEY");
        const safeQuery = query.replace(/ /g, "+");
        let apiUrl = "https://www.googleapis.com/books/v1/volumes?maxResults=20&printType=books&q=" + safeQuery;

        if (apiKey) {
            apiUrl += "&key=" + apiKey;
        }

        console.log("[BookSearch] URL:", apiUrl);

        const res = $http.send({
            url: apiUrl,
            method: "GET",
            headers: { "Content-Type": "application/json" },
            timeout: 15
        });

        if (res.statusCode !== 200) {
            return c.json(res.statusCode, {
                error: "Google API Hatasi",
                upstream_code: res.statusCode,
                raw: res.raw
            });
        }

        const data = res.json;
        return c.json(200, data.items || []);

    } catch (err) {
        console.log("[BookSearch] Exception:", err);
        return c.json(500, { error: "Beklenmeyen Sunucu Hatasi", details: err.toString() });
    }
});