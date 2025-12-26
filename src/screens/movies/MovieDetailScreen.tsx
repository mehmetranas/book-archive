import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, StatusBar, Dimensions, Animated, Linking, Modal, RefreshControl } from 'react-native';
import Toast from 'react-native-toast-message';
import YoutubePlayer from "react-native-youtube-iframe";
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pb } from '../../services/pocketbase';
import { useMovieDetails } from '../../hooks/useTMDB';
import { addMovieToLibrary } from '../../services/tmdb';
import { Movie } from './MovieLibraryScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
            character_map?: any;
            character_map_status?: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
        };
    };
}

// D3.js Graph HTML Generator
const getGraphHtml = (data: any) => `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
    <style>
        body { margin: 0; background-color: #0f172a; overflow: hidden; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        svg { width: 100vw; height: 100vh; touch-action: none; }
        
        .node circle { 
            stroke: #fff; 
            stroke-width: 3px; 
            cursor: move; 
            transition: all 0.3s ease;
            filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5));
        }
        
        .node text { 
            font-size: 14px; 
            font-weight: 800;
            fill: #ffffff !important; 
            pointer-events: none; 
            text-anchor: middle;
            paint-order: stroke fill;
            stroke: #000000;
            stroke-width: 3px;
            stroke-linejoin: round;
            text-shadow: 0 1px 3px rgba(0,0,0,0.9);
        }

        .link { 
            stroke-opacity: 0.6; 
            stroke-width: 2px; 
            transition: stroke-width 0.2s;
        }

        .link-label-bg {
            fill: #0f172a;
            opacity: 0.8;
            rx: 4;
        }

        .link-label { 
            font-size: 11px; 
            fill: #94a3b8; 
            text-anchor: middle; 
            font-weight: 600;
        }

        .tooltip { 
            position: absolute; 
            background: rgba(15, 23, 42, 0.95); 
            color: white; 
            padding: 12px; 
            border-radius: 8px; 
            pointer-events: none; 
            font-size: 14px; 
            max-width: 250px; 
            display: none; 
            border: 1px solid #334155;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
            line-height: 1.4;
            transform: translate(-50%, -100%); 
            z-index: 100;
        }
    </style>
</head>
<body>
    <div id="tooltip" class="tooltip"></div>
    <div id="container"></div>
    <script>
        const data = ${JSON.stringify(data)};
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Colors
        const colors = {
            protagonist: '#10B981', // Green
            antagonist: '#EF4444',  // Red
            sidekick: '#F59E0B',    // Amber
            neutral: '#6366F1',     // Indigo
            link: '#94a3b8'
        };

        const svg = d3.select("#container").append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height]);

        // Background for zoom
        const bg = svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "transparent");

        const g = svg.append("g");

        // Zoom
        const zoom = d3.zoom()
            .scaleExtent([0.2, 5])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom)
           .call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(0.8));

        // Simulation
        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(220))
            .force("charge", d3.forceManyBody().strength(-2000))
            .force("center", d3.forceCenter(0, 0))
            .force("collide", d3.forceCollide(60).strength(0.7));

        // Links
        const linkGroup = g.append("g").attr("class", "links");
        const link = linkGroup.selectAll("line")
            .data(data.links)
            .join("line")
            .attr("class", "link")
            .attr("stroke", d => {
                if(d.type === 'Enemy' || d.type === 'Rivalry') return '#DC2626';
                if(d.type === 'Love') return '#EC4899';
                if(d.type === 'Family') return '#3B82F6';
                return colors.link;
            });

        // Labels
        const labelGroup = g.append("g").attr("class", "labels");
        const linkLabelBg = labelGroup.selectAll("rect")
            .data(data.links)
            .join("rect")
            .attr("class", "link-label-bg");

        const linkLabel = labelGroup.selectAll("text")
            .data(data.links)
            .join("text")
            .attr("class", "link-label")
            .text(d => d.label || d.type);

        // Nodes
        const node = g.append("g").attr("class", "nodes")
            .selectAll("g")
            .data(data.nodes)
            .join("g")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        node.append("circle")
            .attr("r", 25)
            .attr("fill", d => {
                const g = (d.group || '').toLowerCase();
                if(g.includes('protagonist') || g.includes('başrol')) return colors.protagonist;
                if(g.includes('antagonist') || g.includes('kötü')) return colors.antagonist;
                if(g.includes('sidekick') || g.includes('yancı')) return colors.sidekick;
                return colors.neutral;
            });

        // Node Text (Explicit White)
        node.append("text")
            .attr("dy", 38)
            .attr("fill", "#ffffff") // SVG attr
            .style("fill", "#ffffff") // CSS style override
            .style("stroke", "#000000")
            .style("stroke-width", "3px")
            .style("paint-order", "stroke fill")
            .text(d => d.id);

        // Interaction
        node.on("click", (e, d) => {
            e.stopPropagation();
            const t = document.getElementById('tooltip');
            t.style.display = 'block';
            t.innerHTML = '<strong style="display:block; margin-bottom:4px; font-size:16px;">' + d.id + '</strong>' + 
                          '<span style="opacity:0.8">' + (d.bio || 'Bilgi yok') + '</span>';
            
            let posX = e.pageX;
            let posY = e.pageY + 30;
            if (posX < 100) posX = 100;
            if (posX > width - 100) posX = width - 100;
            if (posY > height - 100) posY = e.pageY - 80;

            t.style.left = posX + 'px';
            t.style.top = posY + 'px';
            t.style.transform = 'translateX(-50%)';
            
            setTimeout(() => { if(t) t.style.display = 'none'; }, 4000);
        });
        
        bg.on("click", () => {
             document.getElementById('tooltip').style.display = 'none';
        });

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            link.each(function(d) {
                const x = (d.source.x + d.target.x) / 2;
                const y = (d.source.y + d.target.y) / 2;
                d.midX = x;
                d.midY = y;
            });

            linkLabel.attr("x", d => d.midX).attr("y", d => d.midY + 3);
            
            linkLabelBg
                .attr("x", d => d.midX - (d.label?.length || d.type?.length || 4) * 3 - 4)
                .attr("y", d => d.midY - 7)
                .attr("width", d => (d.label?.length || d.type?.length || 4) * 6 + 8)
                .attr("height", 14);

            node.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
        });

        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
    </script>
</body>
</html>
`;

const { width } = Dimensions.get('window');
import { useColorScheme } from 'nativewind';

// FEATURE FLAG: Character Analysis disabled for now
const ENABLE_CHARACTER_ANALYSIS = false;

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
    const [mapModalVisible, setMapModalVisible] = useState(false);
    const [cardsModalVisible, setCardsModalVisible] = useState(false);
    const [selectedCharacter, setSelectedCharacter] = useState<any>(null);
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

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchLocal(), refetchTmdb()]);
        setRefreshing(false);
    }, [refetchLocal, refetchTmdb]);

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

                    {/* Note: Navbar moved outside ScrollView for sticky effect */}

                    {/* Bottom Title Area in Header */}
                    <View className="absolute bottom-0 left-0 right-0 px-6 pb-8">
                        {/* Tags / Meta Row */}
                        <View className="flex-row items-center gap-2 mb-3 flex-wrap">
                            {year && (
                                <View className="bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-md border border-white/10">
                                    <Text className="text-white text-xs font-bold">{year}</Text>
                                </View>
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
                                    className="bg-[#F5C518] px-2.5 py-1 rounded-md justify-center items-center"
                                >
                                    <Text className="text-black text-xs font-bold">IMDb</Text>
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
                                                    backgroundColor: (localMovie.expand.global_values?.mood_color)
                                                        ? `${localMovie.expand.global_values.mood_color}30`
                                                        : '#F3F4F6'
                                                }}
                                            >
                                                <Text
                                                    className="text-xs font-bold"
                                                    style={{ color: localMovie.expand.global_values?.mood_color || '#1F2937' }}
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
                    {/* Watch Providers (TR) */}
                    {tmdbMovie?.['watch/providers']?.results?.TR && (
                        <View className="mb-6">
                            {/* Streaming */}
                            {tmdbMovie['watch/providers'].results.TR.flatrate && (
                                <View className="mb-3">
                                    <Text className="text-xs font-bold text-gray-400 mb-2 uppercase">Yayınlanan Platformlar</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {tmdbMovie['watch/providers'].results.TR.flatrate.map((p, index) => (
                                            <View key={index} className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                                <Image
                                                    source={{ uri: `https://image.tmdb.org/t/p/original${p.logo_path}` }}
                                                    className="w-full h-full"
                                                />
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

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



                    {/* NEW: Character Analysis / Graph Section */}
                    {ENABLE_CHARACTER_ANALYSIS && localMovie && (
                        <View className="mb-8">
                            <Text className="text-sm font-bold text-gray-900 dark:text-white mb-4 opacity-70">
                                KARAKTER AĞI (V2)
                            </Text>

                            {(localMovie.expand?.global_values?.character_map) ? (
                                <View>
                                    <View className="bg-gray-900 rounded-xl p-4 mb-3 border border-gray-800 h-40 items-center justify-center relative overflow-hidden">
                                        {/* Mini Preview or Abstract Art */}
                                        <View className="absolute inset-0 bg-indigo-900/20" />
                                        <Icon name="graphql" size={48} color="#6366F1" />
                                        <Text className="text-gray-400 text-xs mt-2">Karakter İlişki Haritası Hazır</Text>
                                    </View>

                                    <View className="flex-row gap-3">
                                        <TouchableOpacity
                                            onPress={() => setMapModalVisible(true)}
                                            className="flex-1 bg-indigo-600 py-3 rounded-lg items-center shadow-lg shadow-indigo-500/30"
                                        >
                                            <Text className="text-white font-bold text-sm">Ağı Görüntüle</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setCardsModalVisible(true)}
                                            className="flex-1 bg-gray-800 py-3 rounded-lg items-center border border-gray-700"
                                        >
                                            <Text className="text-gray-200 font-bold text-sm">Kartları İncele</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (localMovie.expand?.global_values?.character_map_status === 'pending' || localMovie.expand?.global_values?.character_map_status === 'processing') ? (
                                <View className="bg-indigo-50 dark:bg-gray-800 p-4 rounded-xl border border-indigo-100 dark:border-gray-700 flex-row items-center">
                                    <ActivityIndicator size="small" color="#6366F1" />
                                    <View className="ml-3">
                                        <Text className="text-gray-900 dark:text-white font-semibold text-sm">Analiz Yapılıyor...</Text>
                                        <Text className="text-gray-500 dark:text-gray-400 text-xs">Yapay zeka ilişkileri çözümlüyor.</Text>
                                    </View>
                                </View>
                            ) : (
                                <View className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                    <Text className="text-gray-900 dark:text-white font-semibold text-sm mb-1">Karakter İlişkilerini Keşfet</Text>
                                    <Text className="text-gray-500 dark:text-gray-400 text-xs mb-3">
                                        Kim dost, kim düşman? Yapay zeka ile filmdeki karakter ağını görselleştir.
                                    </Text>
                                    <TouchableOpacity
                                        onPress={async () => {
                                            try {
                                                const tmdbId = localMovie.tmdb_id;
                                                const title = localMovie.title;

                                                // 1. Check if Global Record exists
                                                let globalId = localMovie.expand?.global_values?.id;

                                                if (!globalId && tmdbId) {
                                                    const globalRecords = await pb.collection('global_movies').getList(1, 1, {
                                                        filter: `tmdb_id = '${tmdbId}'`,
                                                    });
                                                    if (globalRecords.items.length > 0) {
                                                        globalId = globalRecords.items[0].id;
                                                    }
                                                }

                                                // 2. Create or Update Global
                                                if (globalId) {
                                                    await pb.collection('global_movies').update(globalId, {
                                                        character_map_status: 'pending'
                                                    });
                                                } else {
                                                    // Create new
                                                    const newGlobal = await pb.collection('global_movies').create({
                                                        tmdb_id: tmdbId,
                                                        title: title,
                                                        character_map_status: 'pending'
                                                    });
                                                    globalId = newGlobal.id;
                                                }

                                                // 3. Link to Local (if not already linked)
                                                // IMPORTANT: Only update relation field. Status does not exist locally.
                                                if (localMovie.global_values !== globalId) {
                                                    await pb.collection('movies').update(localMovie.id, {
                                                        global_values: globalId
                                                    });
                                                }

                                                queryClient.invalidateQueries({ queryKey: ['localMovie'] });

                                                Toast.show({
                                                    type: 'success',
                                                    text1: "Analiz Başlatıldı",
                                                    text2: "İlişki ağı oluşturuluyor...",
                                                });
                                                queryClient.invalidateQueries({ queryKey: ['localMovie'] });
                                                Toast.show({
                                                    type: 'success',
                                                    text1: "Analiz Başlatıldı",
                                                    text2: "İlişki ağı oluşturuluyor...",
                                                });
                                            } catch (e) {
                                                Toast.show({ type: 'error', text1: "Hata", text2: "İşlem başarısız." });
                                            }
                                        }}
                                        className="bg-gray-900 dark:bg-gray-700 py-2.5 rounded-lg items-center border border-gray-700 dark:border-gray-600"
                                    >
                                        <Text className="text-white font-medium text-xs">Analizi Başlat</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}

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

            {/* Character Map Modal */}
            <Modal
                visible={mapModalVisible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setMapModalVisible(false)}
            >
                <View className="flex-1 bg-[#111827]">
                    <StatusBar barStyle="light-content" backgroundColor="#111827" />
                    <View className="absolute top-12 left-4 z-50">
                        <TouchableOpacity
                            onPress={() => setMapModalVisible(false)}
                            className="bg-gray-800/80 p-2 rounded-full border border-gray-700"
                        >
                            <Icon name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <WebView
                        originWhitelist={['*']}
                        source={{ html: (localMovie?.expand?.global_values?.character_map) ? getGraphHtml(localMovie.expand.global_values.character_map) : '<h1>No Data</h1>' }}
                        className="flex-1 bg-[#111827]"
                        scrollEnabled={false}
                    />
                </View>
            </Modal>
            {/* Character Cards Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={cardsModalVisible}
                onRequestClose={() => {
                    setCardsModalVisible(false);
                    setSelectedCharacter(null);
                }}
            >
                <View className="flex-1 bg-gray-900">
                    {/* Header */}
                    <View className="flex-row items-center justify-between p-4 border-b border-gray-800 bg-gray-900 shadow-md z-10" style={{ marginTop: insets.top }}>
                        <Text className="text-white text-lg font-bold">Karakter Analizleri</Text>
                        <TouchableOpacity
                            onPress={() => {
                                setCardsModalVisible(false);
                                setSelectedCharacter(null);
                            }}
                            className="p-2 bg-gray-800 rounded-full"
                        >
                            <Icon name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 px-4 pt-4">
                        {localMovie?.expand?.global_values?.character_map?.nodes?.map((node: any, index: number) => {
                            const isSelected = selectedCharacter?.id === node.id;

                            // Find relationships for this character
                            const relationships = localMovie?.expand?.global_values?.character_map?.links?.filter((link: any) =>
                                link.source === node.id || link.target === node.id
                            ) || [];

                            return (
                                <TouchableOpacity
                                    key={index}
                                    activeOpacity={0.9}
                                    onPress={() => setSelectedCharacter(isSelected ? null : node)}
                                    className={`mb-4 rounded-xl overflow-hidden border ${isSelected ? 'border-indigo-500 bg-gray-800' : 'border-gray-800 bg-gray-800/50'}`}
                                >
                                    <View className="p-4">
                                        <View className="flex-row justify-between items-start mb-2">
                                            <View className="flex-row items-center">
                                                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${node.group === 'Protagonist' ? 'bg-indigo-500' :
                                                    node.group === 'Antagonist' ? 'bg-red-500' :
                                                        'bg-gray-600'
                                                    }`}>
                                                    <Text className="text-white font-bold text-lg">{node.id.charAt(0)}</Text>
                                                </View>
                                                <View>
                                                    <Text className="text-white font-bold text-lg">{node.id}</Text>
                                                    <Text className={`text-xs font-medium ${node.group === 'Protagonist' ? 'text-indigo-400' :
                                                        node.group === 'Antagonist' ? 'text-red-400' :
                                                            'text-gray-400'
                                                        }`}>{node.group}</Text>
                                                </View>
                                            </View>
                                            <Icon name={isSelected ? "chevron-up" : "chevron-down"} size={24} color="#9CA3AF" />
                                        </View>

                                        {isSelected && (
                                            <View className="mt-2 border-t border-gray-700 pt-3">
                                                <Text className="text-gray-300 leading-6 mb-4">{node.bio}</Text>

                                                {relationships.length > 0 && (
                                                    <View>
                                                        <Text className="text-gray-500 text-xs font-bold mb-2 uppercase tracking-wider">İlişkiler</Text>
                                                        {relationships.map((rel: any, rIdx: number) => {
                                                            const isSource = rel.source === node.id;
                                                            const otherChar = isSource ? rel.target : rel.source;
                                                            return (
                                                                <View key={rIdx} className="flex-row items-center mb-2 bg-gray-900/50 p-2 rounded">
                                                                    <Icon name="arrow-right-thin" size={16} color="#6366F1" className="mr-2" style={{ opacity: 0.7 }} />
                                                                    <Text className="text-gray-400 text-xs">
                                                                        <Text className="text-white font-bold">{otherChar}</Text> ile <Text className="text-indigo-300">{rel.label}</Text> ({rel.type})
                                                                    </Text>
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                        <View className="h-20" />
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};
