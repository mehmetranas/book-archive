/// <reference path="../pb_data/types.d.ts" />

console.log("--> TMDB Proxy API Hazir (Safe Auth Mode)...");

routerAdd("GET", "/api/tmdb", (c) => {

    // --- MANUEL TOKEN DOGRULAMA V2 (DEBUGLU) ---
    try {
        const req = (typeof c.request === 'function') ? c.request() : c.request;
        const authHeader = req.header.get("Authorization");

        console.log("[DEBUG] Auth Header:", authHeader ? "VAR" : "YOK");

        if (!authHeader) {
            const autoUser = c.get("authRecord");
            if (!autoUser) {
                return c.json(403, {
                    error: "Yetkisiz erişim. Authorization header eksik.",
                    debug_header: "MISSING",
                    debug_auto_user: "MISSING"
                });
            }
        } else {
            const token = authHeader.replace("Bearer ", "").trim();
            if (token) {
                try {
                    let user;
                    // Yontem 1: Parametresiz (Collection belirtmeden)
                    try {
                        user = $app.findAuthRecordByToken(token);
                        console.log("[DEBUG] User Found (No Collection Arg):", user ? user.id : "NULL");
                    } catch (e1) {
                        console.log("[DEBUG] Parametresiz hata:", e1.toString());
                        // Yontem 2: "users" ile (Zaten denedik ama yine de kalsin)
                        try {
                            user = $app.findAuthRecordByToken(token, "users");
                        } catch (e2) {
                            // Yontem 3: DAO ile
                            try {
                                user = $app.dao().findAuthRecordByToken(token, "users");
                            } catch (e3) {
                                throw new Error("All Methods Failed: NO_ARG=" + e1 + ", USERS=" + e2 + ", DAO=" + e3);
                            }
                        }
                    }

                    if (!user) throw new Error("User object is null after find");

                    // Basarili!

                } catch (e) {
                    console.log("[DEBUG] Token Error:", e.toString());
                    return c.json(403, {
                        error: "Gecersiz token.",
                        debug_err: e.toString()
                    });
                }
            } else {
                return c.json(403, { error: "Token bos.", debug_token: "EMPTY" });
            }
        }

    } catch (err) {
        console.log("Auth Check Error:", err);
        return c.json(500, { error: "Auth kontrol hatasi", details: err.toString() });
    }
    // ----------------------------------

    try {
        const getQueryParam = (key) => {
            try { return c.queryParam(key); } catch (e) { }
            try {
                const req = (typeof c.request === 'function') ? c.request() : c.request;
                if (req && req.url && req.url.query) return req.url.query().get(key);
            } catch (e) { }
            return null;
        };

        let cleanPath = getQueryParam("path");
        if (!cleanPath) {
            return c.json(400, { error: "Parametre 'path' eksik. Ornek: ?path=/search/movie" });
        }

        if (!cleanPath.startsWith('/')) {
            cleanPath = '/' + cleanPath;
        }

        const apiKey = $os.getenv("TMDB_API_KEY");
        if (!apiKey) {
            return c.json(500, { error: "Sunucu hatasi: TMDB_API_KEY eksik." });
        }

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

        if (!forwardQuery.includes("language=")) {
            forwardQuery += "&language=tr-TR";
        }

        const apiUrl = "https://api.themoviedb.org/3" + cleanPath + "?api_key=" + apiKey + forwardQuery;

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
