/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/spotify/search", (e) => {
    // 1. Parametreleri Al (PocketBase v0.34 Uyumlu)
    const query = e.request.url.query().get("q");
    let type = e.request.url.query().get("type");

    if (!type) {
        type = "playlist,track";
    }

    if (!query) {
        return e.json(400, { error: "Query param 'q' is required" });
    }

    const clientId = $os.getenv("SPOTIFY_CLIENT_ID");
    const clientSecret = $os.getenv("SPOTIFY_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
        return e.json(500, { error: "Spotify credentials not configured (SPOTIFY_CLIENT_ID/SECRET)" });
    }

    // Base64 helper (Bağımsız ve güvenilir)
    const toBase64 = (str) => {
        try {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
            let output = '';
            for (let i = 0, length = str.length, imod3 = 0; i < length;) {
                const c1 = str.charCodeAt(i++);
                const c2 = str.charCodeAt(i++);
                const c3 = str.charCodeAt(i++);
                const e1 = c1 >> 2;
                const e2 = ((c1 & 3) << 4) | (c2 >> 4);
                const e3 = ((c2 & 15) << 2) | (c3 >> 6);
                const e4 = c3 & 63;
                output += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(isNaN(c2) ? 64 : e3) + chars.charAt(isNaN(c3) ? 64 : e4);
            }
            return output;
        } catch (err) {
            throw new Error("Base64 encoding failed: " + err.toString());
        }
    };

    try {
        // 2. Access Token Al (Client Credentials Flow)
        const tokenRes = $http.send({
            url: "https://accounts.spotify.com/api/token",
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + toBase64(`${clientId}:${clientSecret}`)
            },
            body: "grant_type=client_credentials"
        });

        if (tokenRes.statusCode !== 200) {
            return e.json(500, { error: "Failed to get Spotify token", details: tokenRes.json || tokenRes.raw });
        }

        const tokenData = tokenRes.json;
        const accessToken = tokenData.access_token;

        // 3. Spotify Araması Yap
        // Not: Go URL encode işlemi için encodeURIComponent JS tarafında kullanılabilir
        const searchRes = $http.send({
            url: `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=5`,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        if (searchRes.statusCode !== 200) {
            return e.json(searchRes.statusCode, { error: "Spotify Search Error", details: searchRes.json || searchRes.raw });
        }

        return e.json(200, searchRes.json);

    } catch (err) {
        return e.json(500, { error: "Internal Server Error", message: err.toString() });
    }
});
