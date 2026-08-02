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

interface MusicSearchResult {
  tracks: DeezerTrack[];
  playlists: DeezerPlaylist[];
}

async function searchDeezer(query: string): Promise<MusicSearchResult> {
  const encoded = encodeURIComponent(query);
  const [tracksRes, playlistsRes] = await Promise.all([
    fetch(`https://api.deezer.com/search/track?q=${encoded}&limit=5`),
    fetch(`https://api.deezer.com/search/playlist?q=${encoded}&limit=5`),
  ]);

  if (!tracksRes.ok || !playlistsRes.ok) {
    throw new Error("Deezer search error");
  }

  const tracks = (await tracksRes.json()) as DeezerSearchResponse<DeezerTrack>;
  const playlists = (await playlistsRes.json()) as DeezerSearchResponse<DeezerPlaylist>;

  return { tracks: tracks.data, playlists: playlists.data };
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

      let result: MusicSearchResult;
      try {
        result = await searchDeezer(query);
      } catch {
        return reply.code(502).send({ error: "Deezer search error" });
      }

      // The AI-generated mood keyword is often 3-4 words (e.g. "gritty industrial
      // ambient"), which Deezer's title-match search frequently matches nothing on.
      // Progressively drop the leading word and retry until something comes back.
      let words = query.trim().split(/\s+/);
      while (result.tracks.length === 0 && result.playlists.length === 0 && words.length > 1) {
        words = words.slice(1);
        result = await searchDeezer(words.join(" "));
      }

      return reply.send(result);
    },
  );
}
