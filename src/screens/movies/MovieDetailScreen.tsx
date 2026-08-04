import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, StatusBar, Dimensions, Animated, Linking, Modal, RefreshControl, Pressable } from 'react-native';
import YoutubePlayer from "react-native-youtube-iframe";
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pb } from '../../services/pocketbase';
import { useMovieDetails } from '../../hooks/useTMDB';
import { addMovieToLibrary, getCollectionDetailsProxy } from '../../services/tmdb';
import { Movie } from './MovieLibraryScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

interface MovieExtended extends Movie {
    global_values?: string;
    // Note: status fields are NOT in 'movies' collection, only in 'global_movies'
    expand?: {
        global_values?: {
            id?: string;
            vibes?: any;
            mood_color?: string;
            ai_summary?: string;
            vibe_status?: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
        };
    };
}

const { width } = Dimensions.get('window');

export const MovieDetailScreen = () => {
    const { colorScheme } = useColorScheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const route = useRoute();
    const navigation = useNavigation<any>();
    const queryClient = useQueryClient();

    // Accept parsed params: either a local movieId or a TMDB ID
    const params = route.params as { movieId?: string; tmdbId?: number; mediaType?: 'movie' | 'tv' };
    const initialMovieId = params.movieId;
    const initialTmdbId = params.tmdbId;
    const initialMediaType = params.mediaType || 'movie';
    const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
    const [imdbModalVisible, setImdbModalVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // 1. Fetch Local Movie Data (to check if saved and get details)
    const { data: localMovieData, isLoading: isLocalLoading, refetch: refetchLocal } = useQuery({
        queryKey: ['localMovie', initialMovieId, initialTmdbId],
        queryFn: async () => {
            try {
                if (initialMovieId) {
                    return await pb.collection('movies').getOne<Movie>(initialMovieId, { expand: 'global_values' });
                }
                if (initialTmdbId) {
                    // Try to find if we already have this movie
                    const records = await pb.collection('movies').getList<Movie>(1, 1, {
                        filter: `tmdb_id = "${initialTmdbId}"`,
                        expand: 'global_values' // Expanded to get global analysis data
                    });
                    return records.items[0] || null;
                }
                return null;
            } catch (e) {
                console.log('Error fetching local movie:', e);
                return null;
            }
        },
    });

    // Cast to Extended
    const localMovie = localMovieData as MovieExtended | null;

    // Auto-Link Global Values if missing
    useEffect(() => {
        const linkGlobalValues = async () => {
            if (!localMovie || localMovie.global_values || !localMovie.tmdb_id) return;

            try {
                // Check if a global record exists
                const globalRecords = await pb.collection('global_movies').getList(1, 1, {
                    filter: `tmdb_id = '${localMovie.tmdb_id}'`,
                });

                if (globalRecords.items.length > 0) {
                    const globalId = globalRecords.items[0].id;
                    // Link it
                    await pb.collection('movies').update(localMovie.id, {
                        global_values: globalId
                    });
                    console.log('Auto-linked global_values:', globalId);
                    queryClient.invalidateQueries({ queryKey: ['localMovie'] });
                }
            } catch (error) {
                console.log('Error auto-linking global values:', error);
            }
        };

        linkGlobalValues();
    }, [localMovie?.id, localMovie?.global_values, localMovie?.tmdb_id]);

    const activeTmdbId = localMovie ? Number(localMovie.tmdb_id) : initialTmdbId;

    // 2. Fetch TMDB Details Data using new hook
    // Robust detection: If ANY indicator says 'tv', treat it as 'tv'.
    const isTv = localMovie?.type === 'tv' || (localMovie as any)?.media_type === 'tv_show' || initialMediaType === 'tv';
    const activeMediaType = isTv ? 'tv' : 'movie';
    const { data: tmdbMovie, isLoading: isTmdbLoading, error: tmdbError, refetch: refetchTmdb } = useMovieDetails(activeTmdbId || 0, activeMediaType);

    // 3. Fetch Collection Data if belongs_to_collection exists
    const collectionId = tmdbMovie?.belongs_to_collection?.id;
    const { data: collection, refetch: refetchCollection } = useQuery({
        queryKey: ['collection', collectionId],
        queryFn: () => collectionId ? getCollectionDetailsProxy(collectionId) : null,
        enabled: !!collectionId,
    });

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchLocal(), refetchTmdb(), collectionId ? refetchCollection() : Promise.resolve()]);
        setRefreshing(false);
    }, [refetchLocal, refetchTmdb, refetchCollection, collectionId]);

    // Add Movie Mutation
    const addMutation = useMutation({
        mutationFn: async () => {
            if (!tmdbMovie) throw new Error("No TMDB data");
            const movieToAdd = { ...tmdbMovie, media_type: initialMediaType };
            return await addMovieToLibrary(movieToAdd);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['movies'] });
            queryClient.invalidateQueries({ queryKey: ['localMovie'] }); // Refresh local state to show Delete button
            Alert.alert(t('common.success'), t('search.movieAdded', 'Film kütüphaneye eklendi'));
        },
        onError: (err) => {
            Alert.alert(t('common.error'), t('search.addMovieError', 'Film eklenirken bir hata oluştu.'));
        }
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            // We need the ID of the record to delete. 
            // If we found a localMovie, we use its ID.
            if (localMovie?.id) {
                return await pb.collection('movies').delete(localMovie.id);
            }
            throw new Error("No local movie to delete");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['movies'] });
            queryClient.invalidateQueries({ queryKey: ['localMovie'] });
            // If we came from library, go back. If from search, maybe stay or update UI?
            // User said: "remove delete option" in this context? No, user said "durum ve yayinci bilgisi alanlarida olmasin" (remove status and publisher info).
            // Previous request was to allow adding.
            // If deleted, we should probably just update state to show "Add" button again, OR go back if explicit navigation.
            // But if generic, maybe just update state.
            // Current behavior: navigation.goBack().
            // If I am on Details from Search, and I Add then Delete, I probably want to stay or go back to Search.
            // Safest: goBack() if it was passed a movieId (implies existing).
            if (initialMovieId) {
                navigation.goBack();
            } else {
                // From search, just invalidate to show Add button again
            }
        },
        onError: (err) => {
            Alert.alert(t('common.error'), t('common.deleteError', 'Silme işlemi başarısız oldu.'));
        }
    });

    // Scroll Animation Values
    const scrollY = React.useRef(new Animated.Value(0)).current;

    const headerOpacity = scrollY.interpolate({
        inputRange: [300, 400],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const headerBackgroundOpacity = scrollY.interpolate({
        inputRange: [300, 400],
        outputRange: [0, 0.9],
        extrapolate: 'clamp',
    });

    const handleDelete = () => {
        if (!localMovie) return;
        Alert.alert(
            t('common.delete', 'Sil'),
            t('common.deleteConfirmation', 'Bu filmi silmek istediğinize emin misiniz?'),
            [
                { text: t('common.cancel', 'İptal'), style: 'cancel' },
                {
                    text: t('common.delete', 'Sil'),
                    style: 'destructive',
                    onPress: () => deleteMutation.mutate()
                }
            ]
        );
    };

    if (isLocalLoading || (activeTmdbId && isTmdbLoading)) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    if (!localMovie && !tmdbMovie) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                <Text className="text-gray-500 dark:text-gray-400">Film bulunamadı.</Text>
            </View>
        );
    }

    // Use TMDB data if available, fallback to local data
    const title = tmdbMovie?.title || localMovie?.title;
    const overview = tmdbMovie?.overview || localMovie?.description || localMovie?.ai_notes; // Fallback chain
    const backdropPath = tmdbMovie?.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${tmdbMovie.backdrop_path}`
        : null;
    const posterPath = tmdbMovie?.poster_path
        ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
        : localMovie?.poster_url?.startsWith('http') ? localMovie.poster_url : null;

    const runtime = tmdbMovie?.runtime ? `${Math.floor(tmdbMovie.runtime / 60)}h ${tmdbMovie.runtime % 60}m` : null;
    const year = tmdbMovie?.release_date ? tmdbMovie.release_date.split('-')[0] : (localMovie?.release_date ? localMovie.release_date.split('-')[0] : null);
    const voteAverage = tmdbMovie?.vote_average ? tmdbMovie.vote_average.toFixed(1) : null;

    // Certification Logic
    const releaseDates = tmdbMovie?.release_dates?.results || [];
    const trRelease = releaseDates.find((r) => r.iso_3166_1 === 'TR');
    const usRelease = releaseDates.find((r) => r.iso_3166_1 === 'US');
    const tmdbCertification =
        trRelease?.release_dates?.find(d => d.certification)?.certification ||
        usRelease?.release_dates?.find(d => d.certification)?.certification;

    const certification = localMovie?.certification || tmdbCertification;

    const formatCertification = (cert?: string | null) => {
        if (!cert) return null;
        // US / International Codes -> Age Based Mapping
        const mapping: Record<string, string> = {
            'G': 'Genel İzleyici', // General Audiences
            'PG': '7+',            // Parental Guidance Suggested
            'PG-13': '13+',        // Parents Strongly Cautioned
            'R': '18+',            // Restricted
            'NC-17': '18+',        // Adults Only
            'NR': 'Belirtilmemiş',
            'Unrated': 'Belirtilmemiş',
            'TV-Y': 'Genel',
            'TV-Y7': '7+',
            'TV-G': 'Genel',
            'TV-PG': '7+',
            'TV-14': '13+',
            'TV-MA': '18+'
        };

        return mapping[cert] || cert;
    };

    return (
        <View className="flex-1 bg-white dark:bg-gray-950">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Navbar Overlay - Fixed at top */}
            <View
                className="absolute top-0 left-0 right-0 z-50"
                style={{ paddingTop: insets.top }}
            >
                {/* Animated Background */}
                <Animated.View
                    className="absolute top-0 left-0 right-0 bottom-0 bg-gray-950 border-b border-gray-800"
                    style={{ opacity: headerBackgroundOpacity }}
                />

                <View className="flex-row justify-between items-center px-4 h-14">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-10 h-10 rounded-full items-center justify-center z-10"
                        style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                    >
                        <Icon name="arrow-left" size={24} color="white" />
                    </TouchableOpacity>

                    {/* Sticky Title */}
                    <Animated.Text
                        className="flex-1 text-white font-bold text-center text-lg mx-4"
                        numberOfLines={1}
                        style={{ opacity: headerOpacity }}
                    >
                        {title}
                    </Animated.Text>

                    {/* Add / Delete Action Button */}
                    <View className="flex-row items-center gap-2">
                        {/* Vibe button removed - Auto analysis */}
                        {localMovie ? (
                            <TouchableOpacity
                                onPress={handleDelete}
                                className="w-10 h-10 rounded-full items-center justify-center bg-red-500/80"
                            >
                                <Icon name="trash-can-outline" size={20} color="white" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => addMutation.mutate()}
                                disabled={addMutation.isPending}
                                className="w-10 h-10 rounded-full items-center justify-center bg-blue-500/80"
                            >
                                {addMutation.isPending ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Icon name="plus" size={24} color="white" />
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            <Animated.ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 100 }}
                bounces={true}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" progressViewOffset={insets.top + 60} />
                }
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
            >
                {/* Backdrop Image Area */}
                <View className="relative w-full h-[450px]">
                    {backdropPath ? (
                        <Image
                            source={{ uri: backdropPath }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-full bg-gray-900 items-center justify-center">
                            <Icon name="movie-open-outline" size={64} color="#4B5563" />
                        </View>
                    )}

                    {/* Simple Gradient Simulation using Views for compatibility without rebuilding */}
                    <View className="absolute bottom-0 w-full h-[80%] bg-black/20" />
                    <View className="absolute bottom-0 w-full h-[50%] bg-black/50" />
                    <View className="absolute bottom-0 w-full h-[20%] bg-black/80" />

                    {/* Trailer Play Button */}
                    {tmdbMovie?.videos?.results?.some(v => v.site === 'YouTube') && (
                        <View className="absolute inset-0 items-center justify-center">
                            <TouchableOpacity
                                onPress={() => {
                                    const trailer = tmdbMovie.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || tmdbMovie.videos.results[0];
                                    setPlayingVideoId(trailer.key);
                                }}
                                className="w-16 h-16 bg-blue-500 rounded-full items-center justify-center shadow-2xl border-4 border-white/20"
                            >
                                <Icon name="play" size={36} color="white" />
                            </TouchableOpacity>
                            <Text className="text-white font-bold mt-2 shadow-sm uppercase tracking-widest text-[10px]">
                                {t('library.watchTrailer', 'Fragmanı İzle')}
                            </Text>
                        </View>
                    )}

                    {/* Note: Navbar moved outside ScrollView for sticky effect */}

                    {/* Bottom Title Area in Header */}
                    <View className="absolute bottom-0 left-0 right-0 px-6 pb-8">
                        {/* Tags / Meta Row */}
                        <View className="flex-row items-center gap-2 mb-3 flex-wrap">
                            {year && (
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('DiscoveryList', {
                                        id: year,
                                        name: String(year),
                                        role: 'year'
                                    })}
                                    className="bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-md border border-white/10"
                                >
                                    <Text className="text-white text-xs font-bold">{year}</Text>
                                </TouchableOpacity>
                            )}
                            {certification && (
                                <View className="bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-md border border-white/10">
                                    <Text className="text-white text-xs font-bold">{formatCertification(certification)}</Text>
                                </View>
                            )}
                            {runtime && (
                                <View className="bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-md border border-white/10">
                                    <Text className="text-gray-100 text-xs font-bold">{runtime}</Text>
                                </View>
                            )}
                            {voteAverage && (
                                <View className="flex-row items-center bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-md border border-white/10">
                                    <Icon name="star" size={12} color="#F59E0B" />
                                    <Text className="text-yellow-400 text-xs font-bold ml-1">
                                        {voteAverage} <Text className="text-gray-300 font-normal">({tmdbMovie?.vote_count})</Text>
                                    </Text>
                                </View>
                            )}

                            {/* IMDb Button */}
                            {tmdbMovie?.external_ids?.imdb_id && (
                                <TouchableOpacity
                                    onPress={() => setImdbModalVisible(true)}
                                    className="bg-[#F5C518] px-2.5 py-1 rounded-md shadow-sm ml-1"
                                >
                                    <Text className="text-black text-xs font-black">IMDb</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <Text className="text-4xl font-black text-white leading-tight shadow-sm">
                            {title}
                        </Text>

                        {tmdbMovie?.tagline ? (
                            <Text className="text-gray-300 text-sm italic mt-2 opacity-90">
                                "{tmdbMovie.tagline}"
                            </Text>
                        ) : null}


                    </View>
                </View>

                {/* Content Body */}
                <View className="px-6 pt-4">

                    {/* VIBE RESULTS (Strictly from Global Values) */}
                    {localMovie?.expand?.global_values && (localMovie.expand.global_values.vibes || localMovie.expand.global_values.vibe_status === 'pending' || localMovie.expand.global_values.vibe_status === 'processing') && (
                        <View className="mb-6">
                            {(localMovie.expand.global_values.vibes) ? (
                                <View>
                                    {/* Vibe Tags */}
                                    <View className="flex-row flex-wrap gap-2 mb-3">
                                        {(localMovie.expand.global_values.vibes || []).map((vibe: string, i: number) => (
                                            <View
                                                key={i}
                                                className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm"
                                                style={{
                                                    backgroundColor: (localMovie?.expand?.global_values?.mood_color)
                                                        ? `${localMovie.expand.global_values.mood_color}30`
                                                        : '#F3F4F6'
                                                }}
                                            >
                                                <Text
                                                    className="text-xs font-bold"
                                                    style={{ color: localMovie?.expand?.global_values?.mood_color || '#1F2937' }}
                                                >
                                                    {vibe}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* AI Mood Summary */}
                                    {localMovie.expand.global_values.ai_summary && (
                                        <View
                                            className="p-3 rounded-lg border-l-4 bg-gray-50 dark:bg-gray-800 shadow-sm"
                                            style={{ borderLeftColor: localMovie.expand.global_values.mood_color || '#6366F1' }}
                                        >
                                            <Text className="text-gray-700 dark:text-gray-300 text-sm italic leading-5 font-medium">
                                                "{localMovie.expand.global_values.ai_summary}"
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ) : (localMovie.expand.global_values.vibe_status === 'pending' || localMovie.expand.global_values.vibe_status === 'processing') ? (
                                <View className="mb-6 flex-row items-center bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                    <ActivityIndicator size="small" color="#6366F1" />
                                    <Text className="text-indigo-600 dark:text-indigo-300 text-sm font-medium ml-3">
                                        Yapay zeka film atmosferini analiz ediyor...
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    )}
                    {/* Watch Providers (TR) - Ultra Minimalist */}
                    <View className="mb-8 px-1 flex-row items-start">
                        <View className="mt-1 mr-4">
                            <Icon name="play-box-multiple-outline" size={22} color="#9CA3AF" />
                        </View>

                        <View className="flex-1">
                            {tmdbMovie?.['watch/providers']?.results?.TR ? (
                                <View className="gap-y-3">
                                    {/* Streaming */}
                                    {tmdbMovie['watch/providers'].results.TR.flatrate && (
                                        <View className="flex-row flex-wrap">
                                            {tmdbMovie['watch/providers'].results.TR.flatrate.map((p, index) => (
                                                <Pressable
                                                    key={index}
                                                    onPress={() => Linking.openURL(tmdbMovie['watch/providers']?.results?.TR?.link || '')}
                                                    className="w-10 h-10 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white mr-2 mb-1 shadow-sm"
                                                >
                                                    <Image source={{ uri: `https://image.tmdb.org/t/p/w200${p.logo_path}` }} className="w-full h-full" />
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}

                                    {/* Rent & Buy (Grouped or separated with subtle spacing) */}
                                    {(tmdbMovie['watch/providers'].results.TR.rent || tmdbMovie['watch/providers'].results.TR.buy) && (
                                        <View className="flex-row flex-wrap border-t border-gray-100 dark:border-gray-800 pt-2 opacity-80">
                                            {/* Deduplicate Rent/Buy for even more minimalism if needed, or just show them */}
                                            {[...(tmdbMovie['watch/providers'].results.TR.rent || []), ...(tmdbMovie['watch/providers'].results.TR.buy || [])]
                                                // Unique by provider_id to avoid duplicates if same for rent/buy
                                                .filter((v, i, a) => a.findIndex(t => t.provider_id === v.provider_id) === i)
                                                .map((p, index) => (
                                                    <Pressable
                                                        key={index}
                                                        onPress={() => Linking.openURL(tmdbMovie['watch/providers']?.results?.TR?.link || '')}
                                                        className="w-9 h-9 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white mr-2 mb-1"
                                                    >
                                                        <Image source={{ uri: `https://image.tmdb.org/t/p/w200${p.logo_path}` }} className="w-full h-full" />
                                                    </Pressable>
                                                ))
                                            }
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <Text className="text-gray-400 text-[10px] italic pt-1">
                                    {t('detail.noProviders', 'Dijital platformda yok.')}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Genres */}
                    {tmdbMovie?.genres && tmdbMovie.genres.length > 0 && (
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {tmdbMovie.genres.map((g) => (
                                <TouchableOpacity
                                    key={g.id}
                                    onPress={() => navigation.navigate('DiscoveryList', {
                                        id: g.id,
                                        name: g.name,
                                        role: 'genre'
                                    })}
                                    className="border border-gray-200 dark:border-gray-800 rounded-full px-3 py-1 bg-gray-50 dark:bg-gray-900 shadow-sm"
                                >
                                    <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {g.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Overview */}
                    <View className="mb-8">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                            {t('detail.description', 'Özet')}
                        </Text>
                        <Text className="text-gray-600 dark:text-gray-300 leading-7 text-base">
                            {overview || t('detail.noDescription', 'Henüz bir özet yok.')}
                        </Text>
                    </View>

                    {/* Videos */}
                    {tmdbMovie?.videos?.results && tmdbMovie.videos.results.length > 0 && (
                        <View className="mb-8">
                            <Text className="text-sm font-bold text-gray-900 dark:text-white mb-4 opacity-70">
                                VİDEOLAR
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {tmdbMovie.videos.results
                                    .filter(v => v.site === 'YouTube')
                                    .map((video) => (
                                        <TouchableOpacity
                                            key={video.id}
                                            className="mr-4 w-48 mb-1"
                                            onPress={() => setPlayingVideoId(video.key)}
                                        >
                                            <View className="w-48 h-28 bg-black rounded-lg overflow-hidden mb-2 relative justify-center items-center shadow-lg">
                                                <Image
                                                    source={{ uri: `https://img.youtube.com/vi/${video.key}/mqdefault.jpg` }}
                                                    className="w-full h-full opacity-90"
                                                    resizeMode="cover"
                                                />
                                                <View className="absolute bg-white/20 p-3 rounded-full backdrop-blur-sm border border-white/30">
                                                    <Icon name="play" size={20} color="white" />
                                                </View>
                                            </View>
                                            <Text className="text-xs font-semibold text-gray-900 dark:text-white leading-4" numberOfLines={2}>
                                                {video.name}
                                            </Text>
                                            <Text className="text-[10px] text-gray-500 mt-0.5">{video.type}</Text>
                                        </TouchableOpacity>
                                    ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Cast & Crew */}
                    {(tmdbMovie?.credits?.cast && tmdbMovie.credits.cast.length > 0 || tmdbMovie?.credits?.crew?.find(c => c.job === 'Director')) && (
                        <View className="mb-8">
                            <Text className="text-sm font-bold text-gray-900 dark:text-white mb-4 opacity-70">
                                OYUNCULAR & EKİP
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {/* Director */}
                                {tmdbMovie?.credits?.crew?.filter(c => c.job === 'Director').map((director) => (
                                    <TouchableOpacity
                                        key={`director-${director.id}`}
                                        className="mr-4 w-24"
                                        onPress={() => navigation.navigate('DiscoveryList', {
                                            id: director.id,
                                            name: director.name,
                                            role: 'director'
                                        })}
                                    >
                                        <View className="w-24 h-36 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden mb-2 border-2 border-blue-100 dark:border-blue-900">
                                            {director.profile_path ? (
                                                <Image
                                                    source={{ uri: `https://image.tmdb.org/t/p/w200${director.profile_path}` }}
                                                    className="w-full h-full"
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View className="flex-1 items-center justify-center">
                                                    <Icon name="movie-open" size={32} color="#9CA3AF" />
                                                </View>
                                            )}
                                        </View>
                                        <Text className="text-xs font-semibold text-gray-900 dark:text-white" numberOfLines={1}>{director.name}</Text>
                                        <Text className="text-[10px] text-blue-500 font-bold" numberOfLines={1}>{t('library.directorName', 'Yönetmen')}</Text>
                                    </TouchableOpacity>
                                ))}

                                {/* Cast */}
                                {tmdbMovie?.credits?.cast?.slice(0, 10).map((c) => (
                                    <TouchableOpacity
                                        key={c.id}
                                        className="mr-4 w-24"
                                        onPress={() => navigation.navigate('DiscoveryList', {
                                            id: c.id,
                                            name: c.name,
                                            role: 'actor'
                                        })}
                                    >
                                        <View className="w-24 h-36 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden mb-2">
                                            {c.profile_path ? (
                                                <Image
                                                    source={{ uri: `https://image.tmdb.org/t/p/w200${c.profile_path}` }}
                                                    className="w-full h-full"
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View className="flex-1 items-center justify-center">
                                                    <Icon name="account" size={32} color="#9CA3AF" />
                                                </View>
                                            )}
                                        </View>
                                        <Text className="text-xs font-semibold text-gray-900 dark:text-white" numberOfLines={1}>{c.name}</Text>
                                        <Text className="text-[10px] text-gray-500 dark:text-gray-400" numberOfLines={1}>{c.character}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Collection Movies */}
                    {collection?.parts && collection.parts.length > 1 && (
                        <View className="mb-8">
                            <Text className="text-sm font-bold text-gray-900 dark:text-white mb-4 opacity-70 uppercase">
                                {collection.name} SERİSİ
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {collection.parts
                                    .filter((m: any) => m.id !== activeTmdbId)
                                    .sort((a: any, b: any) => new Date(a.release_date || 0).getTime() - new Date(b.release_date || 0).getTime())
                                    .map((m: any) => (
                                        <TouchableOpacity
                                            key={m.id}
                                            className="mr-4 w-28"
                                            onPress={() => navigation.push('MovieDetail', { tmdbId: m.id, mediaType: 'movie' })}
                                        >
                                            <View className="w-28 h-40 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden mb-2 shadow-sm">
                                                {m.poster_path ? (
                                                    <Image
                                                        source={{ uri: `https://image.tmdb.org/t/p/w200${m.poster_path}` }}
                                                        className="w-full h-full"
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <View className="flex-1 items-center justify-center">
                                                        <Icon name="movie" size={32} color="#9CA3AF" />
                                                    </View>
                                                )}
                                            </View>
                                            <Text className="text-xs font-semibold text-gray-900 dark:text-white" numberOfLines={2}>{m.title}</Text>
                                            <View className="flex-row items-center mt-1">
                                                <Text className="text-[10px] text-gray-500 font-medium">{m.release_date?.split('-')[0]}</Text>
                                                {m.vote_average > 0 && (
                                                    <>
                                                        <View className="w-1 h-1 rounded-full bg-gray-300 mx-1.5" />
                                                        <Icon name="star" size={10} color="#F59E0B" />
                                                        <Text className="text-[10px] text-gray-500 ml-1">{m.vote_average.toFixed(1)}</Text>
                                                    </>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Videos & Trailers Carousel */}
                    {tmdbMovie?.videos?.results && tmdbMovie.videos.results.length > 1 && (
                        <View className="mb-8">
                            <Text className="text-sm font-bold text-gray-900 dark:text-white mb-4 opacity-70 uppercase tracking-widest">
                                {t('detail.videos', 'FRAGMANLAR & VİDEOLAR')}
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {tmdbMovie.videos.results.slice(0, 10).map((video) => (
                                    <TouchableOpacity
                                        key={video.id}
                                        className="mr-4 w-48"
                                        onPress={() => setPlayingVideoId(video.key)}
                                    >
                                        <View className="w-48 h-28 bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden mb-2 relative">
                                            <Image
                                                source={{ uri: `https://img.youtube.com/vi/${video.key}/mqdefault.jpg` }}
                                                className="w-full h-full"
                                                resizeMode="cover"
                                            />
                                            <View className="absolute inset-0 items-center justify-center bg-black/20">
                                                <Icon name="play-circle" size={40} color="white" />
                                            </View>
                                        </View>
                                        <Text className="text-xs font-bold text-gray-900 dark:text-white" numberOfLines={2}>{video.name}</Text>
                                        <Text className="text-[10px] text-gray-400 mt-1 uppercase">{video.type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Similar Movies */}
                    {tmdbMovie?.similar?.results && tmdbMovie.similar.results.length > 0 && (
                        <View className="mb-8">
                            <Text className="text-sm font-bold text-gray-900 dark:text-white mb-4 opacity-70">
                                BENZER İÇERİKLER
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {tmdbMovie.similar.results.slice(0, 10).map((m) => (
                                    <View key={m.id} className="mr-4 w-28">
                                        <View className="w-28 h-40 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden mb-2 shadow-sm">
                                            {m.poster_path ? (
                                                <Image
                                                    source={{ uri: `https://image.tmdb.org/t/p/w200${m.poster_path}` }}
                                                    className="w-full h-full"
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View className="flex-1 items-center justify-center">
                                                    <Icon name="movie" size={32} color="#9CA3AF" />
                                                </View>
                                            )}
                                        </View>
                                        <Text className="text-xs font-semibold text-gray-900 dark:text-white" numberOfLines={2}>{m.title}</Text>
                                        <View className="flex-row items-center mt-1">
                                            <Icon name="star" size={10} color="#F59E0B" />
                                            <Text className="text-[10px] text-gray-500 ml-1">{m.vote_average.toFixed(1)}</Text>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}



                </View>
            </Animated.ScrollView>

            {/* Video Player Modal */}
            <Modal
                visible={!!playingVideoId}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPlayingVideoId(null)}
            >
                <View className="flex-1 bg-black justify-center relative">
                    <TouchableOpacity
                        className="absolute top-12 right-6 z-50 p-2 bg-gray-800/50 rounded-full"
                        onPress={() => setPlayingVideoId(null)}
                    >
                        <Icon name="close" size={30} color="white" />
                    </TouchableOpacity>

                    <View className="w-full aspect-video">
                        <YoutubePlayer
                            height={width * 9 / 16}
                            play={true}
                            videoId={playingVideoId || undefined}
                            onChangeState={(event) => {
                                if (event === "ended") setPlayingVideoId(null);
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* IMDb WebView Modal */}
            <Modal
                visible={imdbModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setImdbModalVisible(false)}
            >
                <View className="flex-1 bg-white dark:bg-gray-900">
                    <View className="flex-row items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <Text className="font-bold text-gray-900 dark:text-white">IMDb</Text>
                        <TouchableOpacity
                            onPress={() => setImdbModalVisible(false)}
                            className="bg-gray-200 dark:bg-gray-700 p-1.5 rounded-full"
                        >
                            <Icon name="close" size={20} color={colorScheme === 'dark' ? 'white' : 'black'} />
                        </TouchableOpacity>
                    </View>
                    <WebView
                        source={{ uri: `https://www.imdb.com/title/${tmdbMovie?.external_ids?.imdb_id}/` }}
                        startInLoadingState={true}
                        renderLoading={() => (
                            <View className="absolute inset-0 items-center justify-center bg-white dark:bg-gray-900">
                                <ActivityIndicator size="large" color="#F5C518" />
                            </View>
                        )}
                    />
                </View>
            </Modal>

        </View>
    );
};
