import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchMoviesProxy, getMovieDetailsProxy } from '../services/tmdb';

export const useSearchMovies = (query: string, page = 1) => {
    return useQuery({
        queryKey: ['tmdbSearch', query, page],
        queryFn: () => searchMoviesProxy(query, page),
        enabled: query.length > 2,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useMovieDetails = (tmdbId: number) => {
    return useQuery({
        queryKey: ['tmdbMovie', tmdbId],
        queryFn: () => getMovieDetailsProxy(tmdbId),
        enabled: !!tmdbId,
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
};
