import { useQuery } from '@tanstack/react-query';
import { serviceClient } from '../services/api/client';

export interface MusicTrack {
    id: number;
    title: string;
    link: string;
    preview: string;
    artist: { name: string; picture_medium?: string };
    album: { cover_medium?: string };
}

export interface MusicPlaylist {
    id: number;
    title: string;
    link: string;
    picture_medium?: string;
    nb_tracks: number;
    user: { name: string };
}

export interface MusicSearchResponse {
    tracks: MusicTrack[];
    playlists: MusicPlaylist[];
}

export const useMusicSearch = (keyword?: string) => {
    return useQuery({
        queryKey: ['music', keyword],
        queryFn: async (): Promise<MusicSearchResponse | null> => {
            if (!keyword) return null;

            const { data } = await serviceClient.get<MusicSearchResponse>('/music/search', {
                params: { q: keyword },
            });

            return data;
        },
        enabled: !!keyword && keyword.length > 2,
        staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
        retry: 1,
    });
};
