/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/spotify/search", (c) => {
    const query = c.queryParam("q");
    const type = c.queryParam("type") || "playlist,track";

    if (!query) {
        return c.json(400, { error: "Query param 'q' is required" });
    }

    const clientId = $os.getenv("SPOTIFY_CLIENT_ID");
    const clientSecret = $os.getenv("SPOTIFY_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
        return c.json(500, { error: "Spotify credentials not configured (SPOTIFY_CLIENT_ID/SECRET)" });
    }

    try {
        // 1. Get Access Token (Client Credentials Flow)
        // Note: In production you should cache this token!
        const tokenRes = $http.send({
            url: "https://accounts.spotify.com/api/token",
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + $security.base64Encode(`${clientId}:${clientSecret}`)
            },
            body: "grant_type=client_credentials"
        });

        if (tokenRes.statusCode !== 200) {
            throw new Error("Failed to get Spotify token: " + tokenRes.raw);
        }

        const tokenData = tokenRes.json;
        const accessToken = tokenData.access_token;

        // 2. Search Spotify
        const searchRes = $http.send({
            url: `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=5`,
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        if (searchRes.statusCode !== 200) {
            throw new Error("Spotify Search Error: " + searchRes.raw);
        }

        return c.json(200, searchRes.json);

    } catch (err) {
        return c.json(500, { error: err.toString() });
    }
});
