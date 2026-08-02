import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { requireAuth } from "../lib/auth.js";

interface SpotifyTokenResponse {
  access_token: string;
}

export async function spotifySearchRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { q?: string; type?: string } }>(
    "/spotify/search",
    { preHandler: requireAuth },
    async (request, reply) => {
      const query = request.query.q;
      const type = request.query.type ?? "playlist,track";
      if (!query) {
        return reply.code(400).send({ error: "Query param 'q' is required" });
      }

      const basicAuth = Buffer.from(
        `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`,
      ).toString("base64");

      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
        body: "grant_type=client_credentials",
      });

      if (!tokenRes.ok) {
        const details = await tokenRes.text();
        return reply.code(502).send({ error: "Failed to get Spotify token", details });
      }

      const { access_token } = (await tokenRes.json()) as SpotifyTokenResponse;

      const searchUrl = new URL("https://api.spotify.com/v1/search");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("type", type);
      searchUrl.searchParams.set("limit", "5");

      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!searchRes.ok) {
        const details = await searchRes.text();
        return reply.code(searchRes.status).send({ error: "Spotify search error", details });
      }

      return reply.send(await searchRes.json());
    },
  );
}
