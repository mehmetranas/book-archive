/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/spotify/search", (c) => {
    try {
        // Helper to extract params - copied from movie-search.js
        const getQueryParam = (key) => {
            try { return c.queryParam(key); } catch (e) { }
            try {
                const req = (typeof c.request === 'function') ? c.request() : c.request;
                if (req && req.url && req.url.query) return req.url.query().get(key);
            } catch (e) { }
            // Manual fallback
            try {
                const req = (typeof c.request === 'function') ? c.request() : c.request;
                if (req && req.url && req.url.rawQuery) {
                    const parts = req.url.rawQuery.split('&');
                    for (const part of parts) {
                        const [k, v] = part.split('=');
                        if (decodeURIComponent(k) === key) return decodeURIComponent(v.replace(/\+/g, ' '));
                    }
                }
            } catch (e) { }
            return null;
        };

        const query = getQueryParam("q");
        const type = getQueryParam("type") || "playlist,track";

        console.log("Spotify Search Request - Query:", query, "Type:", type);

        if (!query) {
            console.log("Missing query param");
            return c.json(400, { error: "Query param 'q' is required" });
        }

        const clientId = $os.getenv("SPOTIFY_CLIENT_ID");
        const clientSecret = $os.getenv("SPOTIFY_CLIENT_SECRET");

        console.log("Credentials configured:", !!clientId, !!clientSecret);

        if (!clientId || !clientSecret) {
            console.log("Missing Spotify Credentials");
            return c.json(500, { error: "Spotify credentials not configured (SPOTIFY_CLIENT_ID/SECRET)" });
        }

        // Base64 helper for Auth
        const toBase64 = (str) => {
            try {
                // Try standard btoa if available
                return btoa(str);
            } catch (e) {
                // Manual Base64 Implementation
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
            }
        };

        // 1. Get Access Token (Client Credentials Flow)
        console.log("Requesting Spotify Token...");
        const tokenRes = $http.send({
            url: "https://accounts.spotify.com/api/token",
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                // Use our safe base64 helper
                "Authorization": "Basic " + toBase64(`${clientId}:${clientSecret}`)
            },
            body: "grant_type=client_credentials"
        });

        if (tokenRes.statusCode !== 200) {
            console.log("Token Error:", tokenRes.raw);
            return c.json(500, { error: "Failed to get Spotify token", details: tokenRes.json || tokenRes.raw });
        }

        const tokenData = tokenRes.json;
        const accessToken = tokenData.access_token;
        console.log("Token obtained. Searching...");

        // 2. Search Spotify
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=5`;
        console.log("Search URL:", searchUrl);

        const searchRes = $http.send({
            url: searchUrl,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        if (searchRes.statusCode !== 200) {
            console.log("Search Error:", searchRes.raw);
            return c.json(searchRes.statusCode, { error: "Spotify Search Error", details: searchRes.json || searchRes.raw });
        }

        return c.json(200, searchRes.json);

    } catch (err) {
        console.log("Unhandled Error in Spotify Hook:", err);
        return c.json(500, { error: "Internal Server Error", message: err.toString() });
    }
});
