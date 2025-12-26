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
    // TV Specific
    name?: string;
    first_air_date?: string;
    media_type?: 'movie' | 'tv' | 'person';
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
    external_ids?: {
        imdb_id?: string;
        facebook_id?: string;
        instagram_id?: string;
        twitter_id?: string;
    };
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
        // Parametreleri manuel olarak URL'e ekleyelim (En garanti yöntem)
        const queryParams = new URLSearchParams();
        queryParams.append('path', endpoint);

        // Diğer parametreleri ekle
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                queryParams.append(key, String(params[key]));
            }
        });

        const fullUrl = `/api/tmdb?${queryParams.toString()}`;

        // Auth token'i manuel ekleyelim
        const headers: Record<string, string> = {};
        if (pb.authStore.token) {
            headers["Authorization"] = `Bearer ${pb.authStore.token}`;
        }

        const response = await pb.send(fullUrl, {
            method: "GET",
            headers: headers
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

    return tmdbRequest<TMDBSearchResponse>("search/multi", {
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
        append_to_response: "credits,videos,similar,watch/providers,release_dates,external_ids", // Ekstra verileri tek seferde çek
        language: "tr-TR" // Sunucuda varsayılan var ama garanti olsun
    });
};

/**
 * TV Detaylarını Getirir
 * @param tmdbId TV ID
 */
export const getTVDetailsProxy = (tmdbId: number) => {
    return tmdbRequest<TMDBDetailResponse>(`tv/${tmdbId}`, {
        append_to_response: "credits,videos,similar,watch/providers,content_ratings,external_ids",
        language: "tr-TR"
    });
};

/**
 * Günün Trendleri (Film + Dizi karışık)
 * @param timeWindow 'day' | 'week'
 */
export const getTrendingProxy = (timeWindow: 'day' | 'week' = 'day') => {
    return tmdbRequest<TMDBSearchResponse>(`trending/all/${timeWindow}`, {
        language: "tr-TR"
    });
};

/**
 * En İyi Filmler (Top Rated)
 */
export const getTopRatedMoviesProxy = (page = 1) => {
    return tmdbRequest<TMDBSearchResponse>("movie/top_rated", {
        page: page,
        language: "tr-TR"
    });
};

/**
 * Popüler Diziler
 */
export const getPopularTVProxy = (page = 1) => {
    return tmdbRequest<TMDBSearchResponse>("tv/popular", {
        page: page,
        language: "tr-TR"
    });
};

/**
 * Yönetmenin Filmlerini Getirir
 * @param personId Yönetmenin (veya oyuncunun) TMDB ID'si
 * @param page Sayfa numarası
 */
export const getDirectorMoviesProxy = (personId: number, page = 1) => {
    return tmdbRequest<TMDBSearchResponse>("discover/movie", {
        with_crew: personId,
        sort_by: "primary_release_date.desc",
        page: page,
        language: "tr-TR"
    });
};

/**
 * Oyuncunun Filmlerini Getirir
 * @param personId Oyuncunun TMDB ID'si
 * @param page Sayfa numarası
 */
export const getActorMoviesProxy = (personId: number, page = 1) => {
    return tmdbRequest<TMDBSearchResponse>("discover/movie", {
        with_cast: personId,
        sort_by: "primary_release_date.desc",
        page: page,
        language: "tr-TR"
    });
};

export const addMovieToLibrary = async (movie: Movie | TMDBDetailResponse) => {
    // Robust TV detection: explicit type OR presence of tv-specific fields
    const isTv = movie.media_type === 'tv' || (!!(movie as any).first_air_date && !(movie as any).release_date);
    let fullDetails: TMDBDetailResponse;

    // 1. Fetch Details based on Type
    if (isTv) {
        fullDetails = await getTVDetailsProxy(movie.id);
    } else {
        fullDetails = await getMovieDetailsProxy(movie.id);
    }

    // 2. Extract Certification
    let certificate = '';
    if (isTv) {
        const ratings = (fullDetails as any).content_ratings?.results || [];
        const trRating = ratings.find((r: any) => r.iso_3166_1 === 'TR');
        const usRating = ratings.find((r: any) => r.iso_3166_1 === 'US');
        certificate = trRating?.rating || usRating?.rating || '';
    } else {
        const releaseDates = fullDetails.release_dates?.results || [];
        const trRelease = releaseDates.find((r) => r.iso_3166_1 === 'TR');
        const usRelease = releaseDates.find((r) => r.iso_3166_1 === 'US');

        certificate =
            trRelease?.release_dates?.find(d => d.certification)?.certification ||
            usRelease?.release_dates?.find(d => d.certification)?.certification ||
            '';
    }

    // 3. Extract Common Data
    const title = isTv ? (fullDetails as any).name : fullDetails.title;
    const releaseDate = isTv ? (fullDetails as any).first_air_date : fullDetails.release_date;
    const runtime = fullDetails.runtime || (fullDetails as any).episode_run_time?.[0] || 0;
    const genres = fullDetails.genres?.map(g => g.name) || [];

    let director = '';
    if (isTv) {
        const creators = (fullDetails as any).created_by;
        if (creators && creators.length > 0) {
            director = creators.map((c: any) => c.name).join(', ');
        }
    }
    if (!director) {
        director = fullDetails.credits?.crew?.find(c => c.job === 'Director')?.name || '';
    }

    const posterUrl = fullDetails.poster_path
        ? `https://image.tmdb.org/t/p/w500${fullDetails.poster_path}`
        : '';

    const data = {
        title: title || '',
        tmdb_id: String(fullDetails.id),
        overview: fullDetails.overview,
        release_date: releaseDate || '',
        poster_url: posterUrl,
        user: pb.authStore.record?.id,
        enrichment_status: 'pending',
        certification: certificate,
        genres: genres,
        director: director,
        runtime: runtime,
        type: isTv ? 'tv' : 'movie',
        media_type: isTv ? 'tv_show' : 'movie',
    };

    return await pb.collection('movies').create(data);
};
