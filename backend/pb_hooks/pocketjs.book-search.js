/// <reference path="../pb_data/types.d.ts" />

console.log("--> Book Search API (Google Books) Hazir...");

routerAdd("GET", "/api/book_search", (c) => {
    try {
        // Debug: c objesinin yapisini gorelim
        // console.log("Keys of c:", Object.keys(c)); 

        let query = "";

        // Deneme 1: Standard Echo (c.queryParam)
        try { if (c.queryParam) query = c.queryParam("q"); } catch (e) { }

        // Deneme 2: Request object (c.request().url.query().get())
        if (!query) {
            try {
                // c.request() bir fonksiyon mu, property mi?
                const req = (typeof c.request === 'function') ? c.request() : c.request;
                if (req && req.url) {
                    // req.url bir property mi?
                    const url = req.url;
                    // url.query() bir fonksiyon mu?
                    if (url.query && typeof url.query === 'function') {
                        query = url.query().get("q");
                    } else if (url.rawQuery) {
                        // rawQuery varsa manuel parse edelim
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
                debug_keys: Object.keys(c) // Debug icin keys donelim
            });
        }

        const apiKey = $os.getenv("GOOGLE_BOOKS_KEY");
        // encodeURIComponent Goja'da bazen sorun olabilir, basit escape yapalim
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

        console.log("[BookSearch] API Statu Kodu:", res.statusCode);

        if (res.statusCode !== 200) {
            // Hata detayini text olarak alalim
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
        // Hata nesnesini string'e cevirip donelim
        return c.json(500, { error: "Beklenmeyen Sunucu Hatasi", details: err.toString() });
    }
});