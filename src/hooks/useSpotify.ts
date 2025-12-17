import { useQuery } from '@tanstack/react-query';
import { pb } from '../services/pocketbase';

export interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    external_urls: { spotify: string };
    album: { images: { url: string }[] };
    uri: string;
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    description: string;
    external_urls: { spotify: string };
    images: { url: string }[];
    owner: { display_name: string };
    uri: string;
}

export interface SpotifyResponse {
    tracks?: { items: SpotifyTrack[] };
    playlists?: { items: SpotifyPlaylist[] };
}

export const useSpotify = (keyword?: string) => {
    return useQuery({
        queryKey: ['spotify', keyword],
        queryFn: async (): Promise<SpotifyResponse | null> => {
            if (!keyword) return null;

            // Call our backend proxy
            const response = await pb.send('/api/spotify/search', {
                params: {
                    q: keyword,
                    type: 'playlist,track'
                },
                method: 'GET'
            });

            return response as SpotifyResponse;
        },
        enabled: !!keyword && keyword.length > 2,
        staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
        retry: 1
    });
};
