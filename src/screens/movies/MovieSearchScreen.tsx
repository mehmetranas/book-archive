import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ActivityIndicator, TouchableOpacity, Alert, Image, Modal, ScrollView, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDebounce } from '../../hooks/useDebounce';
import { useSearchMovies } from '../../hooks/useTMDB';
import { addMovieToLibrary, Movie, getTrendingProxy, getTopRatedMoviesProxy, getPopularTVProxy } from '../../services/tmdb';
import { pb } from '../../services/pocketbase';

const { width } = Dimensions.get('window');

// --- Components ---

const HorizontalMovieCard = ({ item, onPress, isHero = false }: { item: Movie; onPress: () => void; isHero?: boolean }) => {
    const isTv = item.media_type === 'tv' || !!item.first_air_date;
    const year = (item.release_date || item.first_air_date || '').split('-')[0];

    if (isHero) {
        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPress}
                className="w-full h-64 mb-6 rounded-2xl overflow-hidden relative shadow-lg bg-gray-900"
            >
                <Image
                    source={{ uri: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
                    className="w-full h-full opacity-80"
                    resizeMode="cover"
                />

                {/* Gradient Overlay using absolute Views */}
                <View className="absolute bottom-0 w-full h-full bg-black/10" />
                <View className="absolute bottom-0 w-full h-2/3 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent opacity-90" />

                <View className="absolute bottom-0 left-0 p-4 w-full">
                    {/* Badge */}
                    <View className="bg-red-600 self-start px-2 py-0.5 rounded-md mb-2">
                        <Text className="text-white text-[10px] font-bold uppercase tracking-wider">
                            {isTv ? 'Günün Dizisi' : 'Günün Filmi'}
                        </Text>
                    </View>

                    <Text className="text-white text-2xl font-bold mb-1 shadow-sm" numberOfLines={2}>
                        {item.title || item.name}
                    </Text>

                    <View className="flex-row items-center space-x-3">
                        <View className="flex-row items-center">
                            <Icon name="star" size={14} color="#F59E0B" />
                            <Text className="text-gray-200 text-xs font-bold ml-1">{item.vote_average?.toFixed(1)}</Text>
                        </View>
                        {year ? (
                            <Text className="text-gray-300 text-xs font-medium">{year}</Text>
                        ) : null}
                    </View>

                    <Text className="text-gray-400 text-xs mt-2 line-clamp-2" numberOfLines={2}>
                        {item.overview}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            className="w-32 mr-3"
        >
            <View className="w-32 h-48 bg-gray-800 rounded-xl overflow-hidden shadow-sm relative mb-2">
                {item.poster_path ? (
                    <Image
                        source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
                        className="w-full h-full"
                        resizeMode="cover"
                    />
                ) : (
                    <View className="w-full h-full items-center justify-center bg-gray-800 border border-gray-700">
                        <Icon name="image-off" size={24} color="#6B7280" />
                    </View>
                )}

                {/* Rating Badge */}
                {item.vote_average > 0 && (
                    <View className="absolute top-1 right-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded flex-row items-center">
                        <Icon name="star" size={10} color="#F59E0B" />
                        <Text className="text-white text-[9px] font-bold ml-0.5">{item.vote_average.toFixed(1)}</Text>
                    </View>
                )}

                {/* TV Badge */}
                {isTv && (
                    <View className="absolute top-1 left-1 bg-blue-600 px-1.5 py-0.5 rounded">
                        <Text className="text-white text-[8px] font-bold">DİZİ</Text>
                    </View>
                )}
            </View>
            <Text className="text-gray-900 dark:text-gray-200 text-xs font-semibold text-center leading-4" numberOfLines={2}>
                {item.title || item.name}
            </Text>
        </TouchableOpacity>
    );
};

const ShowcaseSection = ({ title, data, isLoading, navigation }: any) => {
    if (isLoading) {
        return (
            <View className="my-4">
                <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3 px-4">{title}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                    {[1, 2, 3, 4].map(i => (
                        <View key={i} className="w-32 h-48 bg-gray-200 dark:bg-gray-800 rounded-xl mr-3" />
                    ))}
                </ScrollView>
            </View>
        );
    }

    if (!data?.results?.length) return null;

    return (
        <View className="my-5">
            <View className="flex-row justify-between items-center px-4 mb-3">
                <Text className="text-lg font-bold text-gray-900 dark:text-white">{title}</Text>
                {/* <Icon name="chevron-right" size={20} color="#6B7280" /> */}
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                decelerationRate="fast"
                snapToInterval={128 + 12} // width + margin
            >
                {data.results.map((item: Movie) => (
                    <HorizontalMovieCard
                        key={item.id}
                        item={item}
                        onPress={() => {
                            // Determine media type for navigation
                            // For mixed lists (Trending), use item.media_type
                            // For specific lists (Popular TV), force logic
                            // Fallback to 'movie' if ambiguous
                            let mType = item.media_type;
                            if (!mType && item.first_air_date) mType = 'tv';
                            if (!mType) mType = 'movie';

                            navigation.navigate('MovieDetail', {
                                tmdbId: item.id,
                                mediaType: mType
                            });
                        }}
                    />
                ))}
            </ScrollView>
        </View>
    );
};

// --- Main Screen ---

export const MovieSearchScreen = () => {
    const { t, i18n } = useTranslation();
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 500);
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const navigation = useNavigation<any>();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [manualTitle, setManualTitle] = useState('');
    const [manualDirector, setManualDirector] = useState('');

    // Queries for Showcase
    const trendingQuery = useQuery({ queryKey: ['trending', 'day'], queryFn: () => getTrendingProxy('day'), enabled: query.length === 0 });
    const topRatedQuery = useQuery({ queryKey: ['topRated'], queryFn: () => getTopRatedMoviesProxy(), enabled: query.length === 0 });
    const popularTvQuery = useQuery({ queryKey: ['popularTv'], queryFn: () => getPopularTVProxy(), enabled: query.length === 0 });

    // Query for Search
    const { data: searchResult, isLoading: isSearchLoading } = useSearchMovies(debouncedQuery);

    const addMovieMutation = useMutation({
        mutationFn: addMovieToLibrary,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['movies'] });
        },
        onError: (err: any) => {
            console.error('Add movie error:', err);
            Alert.alert(t('common.error'), t('search.addMovieError', 'Film eklenirken bir hata oluştu.'));
        }
    });

    const addManualMovieMutation = useMutation({
        mutationFn: async () => {
            const data = {
                title: manualTitle,
                director: manualDirector,
                poster_url: '',
                enrichment_status: 'pending',
                language_code: i18n.language,
                user: pb.authStore.record?.id,
            };
            return await pb.collection('movies').create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['movies'] });
            setIsModalVisible(false);
            setManualTitle('');
            setManualDirector('');
            Alert.alert(t('common.success'), t('library.manualAddSuccess', 'Film eklendi, yapay zeka detayları araştırıyor...'));
        },
        onError: (err: any) => {
            console.error('Manual add error:', err);
            Alert.alert(t('common.error'), t('library.manualAddError', 'Film eklenirken bir hata oluştu.'));
        }
    });

    const handleManualAdd = () => {
        if (!manualTitle.trim()) {
            Alert.alert(t('common.warning'), t('library.titleRequired', 'Film adı zorunludur.'));
            return;
        }
        addManualMovieMutation.mutate();
    };

    const renderSearchItem = ({ item }: { item: Movie }) => {
        const title = item.title || item.name;
        const date = item.release_date || item.first_air_date;
        const year = date ? date.split('-')[0] : '';
        const isTv = item.media_type === 'tv';

        let pPath = item.poster_path;
        if (pPath && !pPath.startsWith('/')) pPath = '/' + pPath;
        const posterUrl = pPath ? `https://image.tmdb.org/t/p/w185${pPath}` : null;
        const isAdding = addMovieMutation.isPending && addMovieMutation.variables?.id === item.id;
        const isSuccess = addMovieMutation.isSuccess && addMovieMutation.variables?.id === item.id;

        return (
            <TouchableOpacity
                className="flex-row bg-white dark:bg-gray-800 p-3 mb-3 rounded-xl shadow-sm items-center"
                onPress={() => {
                    navigation.navigate('MovieDetail', { tmdbId: item.id, mediaType: item.media_type });
                }}
            >
                <View className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded-md mr-4 overflow-hidden shadow-sm relative">
                    {posterUrl ? (
                        <Image source={{ uri: posterUrl }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                        <View className="w-full h-full items-center justify-center">
                            <Icon name="movie-open" size={24} color="#9CA3AF" />
                        </View>
                    )}
                    {isTv && (
                        <View className="absolute top-0 right-0 bg-blue-600 px-1.5 py-0.5 rounded-bl-md z-10">
                            <Text className="text-[9px] font-bold text-white">DİZİ</Text>
                        </View>
                    )}
                </View>
                <View className="flex-1 mr-2">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white" numberOfLines={2}>{title}</Text>
                    {year ? <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{year}</Text> : null}
                    <View className="flex-row items-center mt-1">
                        <Icon name="star" size={14} color="#F59E0B" />
                        <Text className="text-xs text-gray-600 dark:text-gray-300 ml-1">
                            {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    className={`${isSuccess ? 'bg-green-500' : 'bg-blue-600'} w-10 h-10 rounded-full items-center justify-center shadow-sm`}
                    onPress={() => addMovieMutation.mutate(item)}
                    disabled={isAdding || isSuccess}
                >
                    {isAdding ? <ActivityIndicator size="small" color="white" /> : isSuccess ? <Icon name="check" size={24} color="white" /> : <Icon name="plus" size={24} color="white" />}
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-gray-50 dark:bg-gray-950" style={{ paddingTop: insets.top }}>
            {/* Header */}
            <View className="px-4 pb-2 pt-2 bg-white dark:bg-gray-900 shadow-sm z-20">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('search.movieTitle', 'Film Ara')}
                </Text>

                <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4 border border-gray-200 dark:border-gray-700 mb-2">
                    <Icon name="magnify" size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 py-3 px-2 text-gray-900 dark:text-white text-base"
                        placeholder="Film, Dizi veya Yönetmen..."
                        placeholderTextColor="#9CA3AF"
                        value={query}
                        onChangeText={setQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="off"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <Icon name="close-circle" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content Switcher */}
            {query.length === 0 ? (
                // --- SHOWCASE MODE ---
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero Section */}
                    {trendingQuery.data?.results?.[0] && !trendingQuery.isLoading && (
                        <View className="px-4 mt-4">
                            <HorizontalMovieCard
                                item={trendingQuery.data.results[0]}
                                isHero={true}
                                onPress={() => navigation.navigate('MovieDetail', { tmdbId: trendingQuery.data.results[0].id, mediaType: trendingQuery.data.results[0].media_type })}
                            />
                        </View>
                    )}

                    {/* Lists */}
                    <ShowcaseSection
                        title="Gündemdekiler 🔥"
                        data={trendingQuery.data}
                        isLoading={trendingQuery.isLoading}
                        navigation={navigation}
                    />

                    <ShowcaseSection
                        title="Tüm Zamanların En İyileri 🏆"
                        data={topRatedQuery.data}
                        isLoading={topRatedQuery.isLoading}
                        navigation={navigation}
                    />

                    {/* Pass explicit 'tv' logic if needed, but the card handles basic detection */}
                    <ShowcaseSection
                        title="Popüler Diziler 📺"
                        data={popularTvQuery.data}
                        isLoading={popularTvQuery.isLoading}
                        navigation={navigation}
                    />

                    {/* Manual Add Button at bottom of showcase */}
                    <View className="px-4 py-6 mb-8">
                        <TouchableOpacity
                            onPress={() => setIsModalVisible(true)}
                            className="bg-gray-800 dark:bg-gray-800 py-4 rounded-xl flex-row items-center justify-center border border-gray-700" // Updated bg color to be visible
                            style={{ borderWidth: 1, borderColor: '#374151' }} // Explicit border style for visibility
                        >
                            <Icon name="plus-circle-outline" size={24} color="#9CA3AF" />
                            <Text className="text-gray-400 font-semibold ml-2">Aradığını Bulamadın mı? Manuel Ekle</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            ) : isSearchLoading ? (
                // --- LOADING MODE ---
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : (
                // --- SEARCH RESULTS MODE ---
                <FlashList<Movie>
                    data={searchResult?.results || []}
                    renderItem={renderSearchItem}
                    keyExtractor={(item) => item.id.toString()}
                    estimatedItemSize={120}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center p-6 mt-10">
                            <Icon name="movie-search-outline" size={64} color="#D1D5DB" />
                            <Text className="text-gray-500 dark:text-gray-400 text-center mt-4 text-lg">
                                {t('search.noResults', 'Sonuç bulunamadı')}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Manual Add Modal - Same as before */}
            <Modal
                visible={isModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/50">
                    <View className="bg-white dark:bg-gray-800 w-11/12 rounded-xl p-6 shadow-xl">
                        <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            {t('library.manualAddMovieTitle', 'Manuel Film Ekle')}
                        </Text>

                        <Text className="text-gray-700 dark:text-gray-300 mb-1 font-medium">
                            {t('library.movieTitle', 'Film Adı')} *
                        </Text>
                        <TextInput
                            className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700"
                            placeholder="Örn: The Godfather"
                            placeholderTextColor="#9CA3AF"
                            value={manualTitle}
                            onChangeText={setManualTitle}
                            autoCorrect={false}
                        />

                        <Text className="text-gray-700 dark:text-gray-300 mb-1 font-medium">
                            {t('library.directorName', 'Yönetmen')}
                        </Text>
                        <TextInput
                            className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-6 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700"
                            placeholder="Örn: Francis Ford Coppola"
                            placeholderTextColor="#9CA3AF"
                            value={manualDirector}
                            onChangeText={setManualDirector}
                            autoCorrect={false}
                        />

                        <View className="flex-row justify-end space-x-3">
                            <TouchableOpacity
                                onPress={() => setIsModalVisible(false)}
                                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 mr-2"
                            >
                                <Text className="text-gray-700 dark:text-gray-300 font-medium">
                                    {t('common.cancel', 'İptal')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleManualAdd}
                                className="px-4 py-2 rounded-lg bg-blue-600"
                                disabled={addManualMovieMutation.isPending}
                            >
                                {addManualMovieMutation.isPending ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text className="text-white font-medium">
                                        {t('common.save', 'Kaydet')}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
