import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchMoviesProxy, getMovieDetailsProxy, getTVDetailsProxy } from '../services/tmdb';

export const useSearchMovies = (query: string, page = 1) => {
    return useQuery({
        queryKey: ['tmdbSearch', query, page],
        queryFn: () => searchMoviesProxy(query, page),
        enabled: query.length > 2,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useMovieDetails = (tmdbId: number, mediaType: 'movie' | 'tv' = 'movie') => {
    return useQuery({
        queryKey: ['tmdbDetail', mediaType, tmdbId],
        queryFn: () => mediaType === 'tv' ? getTVDetailsProxy(tmdbId) : getMovieDetailsProxy(tmdbId),
        enabled: !!tmdbId,
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
};
