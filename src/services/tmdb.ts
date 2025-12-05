import { pb } from './pocketbase';

// ------------------------------------------------------------------
// TİP TANIMLAMALARI (Type Safety)
// ------------------------------------------------------------------

// TMDB'den dönen temel Film objesi
export interface Movie {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    poster_path: string | null;
    backdrop_path: string | null;
    vote_average: number;
}

// Arama Sonucu Cevabı
export interface TMDBSearchResponse {
    page: number;
    results: Movie[];
    total_pages: number;
    total_results: number;
}

export interface TMDBGenre {
    id: number;
    name: string;
}

// Detay Cevabı (Oyuncular ve Videolar dahil)
export interface TMDBDetailResponse extends Movie {
    tagline: string;
    status: string;
    genres: TMDBGenre[];
    production_companies: { id: number; logo_path: string | null; name: string }[];
    runtime: number;
    vote_count: number; // Added: How many people voted
    credits: {
        cast: {
            id: number;
            name: string;
            character: string;
            profile_path: string | null;
        }[];
        crew: {
            id: number;
            name: string;
            job: string;
            profile_path: string | null;
        }[];
    };
    videos: {
        results: {
            key: string;
            site: string;
            type: string;
            id: string;
            name: string;
        }[];
    };
    similar?: {
        results: Movie[];
    };
    'watch/providers'?: {
        results: {
            [key: string]: {
                link: string;
                flatrate?: { logo_path: string; provider_name: string }[];
                buy?: { logo_path: string; provider_name: string }[];
                rent?: { logo_path: string; provider_name: string }[];
            };
        };
    };
    release_dates?: {
        results: {
            iso_3166_1: string;
            release_dates: {
                certification: string;
                type: number;
                note?: string;
            }[];
        }[];
    };
}

// ------------------------------------------------------------------
// ANA YARDIMCI FONKSİYON (Generic Proxy Wrapper)
// ------------------------------------------------------------------

/**
 * PocketBase üzerindeki özel proxy endpoint'ine istek atar.
 * @param endpoint TMDB endpoint yolu (örn: "search/movie" veya "movie/550")
 * @param params Query parametreleri (örn: { query: "Matrix" })
 */
export const tmdbRequest = async <T>(endpoint: string, params: Record<string, any> = {}): Promise<T> => {
    try {
        // PocketBase SDK'sının send metodu ile POST isteği atıyoruz.
        // 'body' parametresi sunucunun beklediği JSON yapısıdır.
        const response = await pb.send("/api/tmdb/proxy", {
            method: "POST",
            body: {
                endpoint: endpoint,
                params: params,
            },
        });

        return response as T;
    } catch (error: any) {
        console.error(`TMDB Proxy Error [${endpoint}]:`, error?.message || error);
        throw error;
    }
};

// ------------------------------------------------------------------
// KULLANILACAK FONKSİYONLAR (Methods)
// ------------------------------------------------------------------

/**
 * Film Araması Yapar
 * @param query Aranacak kelime (örn: "Yüzüklerin Efendisi")
 * @param page Sayfa numarası (default: 1)
 */
export const searchMoviesProxy = (query: string, page = 1) => {
    if (!query) return Promise.resolve({ results: [] } as unknown as TMDBSearchResponse);

    return tmdbRequest<TMDBSearchResponse>("search/movie", {
        query: query,
        page: page,
        language: "tr-TR"
    });
};

/**
 * Film Detaylarını Getirir
 * @param tmdbId Filmin TMDB ID'si (örn: 120)
 */
export const getMovieDetailsProxy = (tmdbId: number) => {
    return tmdbRequest<TMDBDetailResponse>(`movie/${tmdbId}`, {
        append_to_response: "credits,videos,similar,watch/providers,release_dates", // Ekstra verileri tek seferde çek
        language: "tr-TR" // Sunucuda varsayılan var ama garanti olsun
    });
};

export const addMovieToLibrary = async (movie: Movie | TMDBDetailResponse) => {
    // 1. Fetch full details to get certification, runtime, extensive genres, director, etc.
    const fullDetails = await getMovieDetailsProxy(movie.id);

    // 2. Extract Certification (TR or US fallback)
    const releaseDates = fullDetails.release_dates?.results || [];
    const trRelease = releaseDates.find((r) => r.iso_3166_1 === 'TR');
    const usRelease = releaseDates.find((r) => r.iso_3166_1 === 'US');

    // Attempt to find a non-empty certification
    const certificate =
        trRelease?.release_dates?.find(d => d.certification)?.certification ||
        usRelease?.release_dates?.find(d => d.certification)?.certification ||
        '';

    // 3. Extract Runtime
    const runtime = fullDetails.runtime || 0;

    // 4. Extract Genres (as array of strings)
    const genres = fullDetails.genres?.map(g => g.name) || [];

    // 5. Extract Director
    const director = fullDetails.credits?.crew?.find(c => c.job === 'Director')?.name || '';

    const posterUrl = fullDetails.poster_path
        ? `https://image.tmdb.org/t/p/w500${fullDetails.poster_path}`
        : '';

    const data = {
        title: fullDetails.title,
        tmdb_id: String(fullDetails.id),
        overview: fullDetails.overview,
        release_date: fullDetails.release_date || '',
        poster_path: posterUrl,
        user: pb.authStore.record?.id,
        enrichment_status: 'pending',
        certification: certificate,
        genres: genres, // PocketBase expects JSON (or array depending on setup, usually handled by SDK)
        director: director,
        runtime: runtime,
    };

    return await pb.collection('movies').create(data);
};
