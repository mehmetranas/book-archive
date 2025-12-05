import { pb } from './pocketbase';

export interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    release_date: string;
    vote_average: number;
}

export interface SearchResult {
    results: TMDBMovie[];
}

export const searchMovies = async (query: string): Promise<TMDBMovie[]> => {
    if (!query) return [];

    try {
        const response = await pb.send('/api/tmdb/search', {
            params: { query },
            method: 'GET',
        });
        return response.results || [];
    } catch (error) {
        console.error('Movie search error:', error);
        throw error;
    }
};

export const addMovie = async (movie: TMDBMovie) => {
    const posterUrl = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : '';

    const data = {
        title: movie.title,
        tmdb_id: movie.id,
        overview: movie.overview,
        release_date: movie.release_date,
        poster_url: posterUrl,
        rating: movie.vote_average,
        user: pb.authStore.record?.id,
        status: 'want_to_watch',
        enrichment_status: 'pending',
    };

    return await pb.collection('movies').create(data);
};
