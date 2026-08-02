import type { FastifyInstance } from "fastify";
import { requireAuth } from "../lib/auth.js";

interface DeezerTrack {
  id: number;
  title: string;
  link: string;
  preview: string;
  artist: { name: string; picture_medium?: string };
  album: { cover_medium?: string };
}

interface DeezerPlaylist {
  id: number;
  title: string;
  link: string;
  picture_medium?: string;
  nb_tracks: number;
  user: { name: string };
}

interface DeezerSearchResponse<T> {
  data: T[];
}

/**
 * Deezer's public search API needs no auth/key and has no premium gate,
 * unlike Spotify's Client Credentials flow which as of 2025 requires the
 * app-owner account itself to have Spotify Premium.
 */
export async function musicSearchRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { q?: string } }>(
    "/music/search",
    { preHandler: requireAuth },
    async (request, reply) => {
      const query = request.query.q;
      if (!query) {
        return reply.code(400).send({ error: "Query param 'q' is required" });
      }

      const encoded = encodeURIComponent(query);
      const [tracksRes, playlistsRes] = await Promise.all([
        fetch(`https://api.deezer.com/search/track?q=${encoded}&limit=5`),
        fetch(`https://api.deezer.com/search/playlist?q=${encoded}&limit=5`),
      ]);

      if (!tracksRes.ok || !playlistsRes.ok) {
        return reply.code(502).send({ error: "Deezer search error" });
      }

      const tracks = (await tracksRes.json()) as DeezerSearchResponse<DeezerTrack>;
      const playlists = (await playlistsRes.json()) as DeezerSearchResponse<DeezerPlaylist>;

      return reply.send({ tracks: tracks.data, playlists: playlists.data });
    },
  );
}
