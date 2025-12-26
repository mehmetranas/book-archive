import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, StatusBar, Dimensions } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useInfiniteQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getDirectorMoviesProxy, getActorMoviesProxy, getGenreMoviesProxy, getYearMoviesProxy } from '../../services/tmdb';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_WIDTH = (width - 48) / COLUMN_COUNT;

export const DiscoveryListScreen = () => {
    const { t } = useTranslation();
    const route = useRoute();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const params = route.params as {
        id: number | string;
        name: string;
        role: 'director' | 'actor' | 'genre' | 'year'
    };
    const { id, name, role } = params;

    const {
        data,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useInfiniteQuery({
        queryKey: ['discoveryList', id, role],
        queryFn: ({ pageParam = 1 }) => {
            if (role === 'director') return getDirectorMoviesProxy(Number(id), pageParam);
            if (role === 'actor') return getActorMoviesProxy(Number(id), pageParam);
            if (role === 'genre') return getGenreMoviesProxy(Number(id), pageParam);
            if (role === 'year') return getYearMoviesProxy(Number(id), pageParam);
            return Promise.resolve({ results: [] } as any);
        },
        getNextPageParam: (lastPage: any) => {
            if (lastPage.page < lastPage.total_pages) {
                return lastPage.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
    });

    const movies = data?.pages.flatMap((page: any) => page.results) || [];

    const renderMovieItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => navigation.push('MovieDetail', { tmdbId: item.id, mediaType: 'movie' })}
            className="mb-4"
            style={{ width: ITEM_WIDTH, marginRight: 8 }}
        >
            <View className="bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm" style={{ height: ITEM_WIDTH * 1.5 }}>
                {item.poster_path ? (
                    <Image
                        source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
                        className="w-full h-full"
                        resizeMode="cover"
                    />
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <Icon name="movie" size={32} color="#9CA3AF" />
                    </View>
                )}
                {item.vote_average > 0 && (
                    <View className="absolute top-2 right-2 bg-black/60 px-1.5 py-0.5 rounded-md flex-row items-center">
                        <Icon name="star" size={10} color="#F59E0B" />
                        <Text className="text-white text-[10px] font-bold ml-1">{item.vote_average.toFixed(1)}</Text>
                    </View>
                )}
            </View>
            <Text className="text-gray-900 dark:text-white text-xs font-semibold mt-2" numberOfLines={2}>
                {item.title}
            </Text>
            {item.release_date && (
                <Text className="text-gray-500 dark:text-gray-400 text-[10px] mt-0.5">
                    {item.release_date.split('-')[0]}
                </Text>
            )}
        </TouchableOpacity>
    );

    const getHeaderLabel = () => {
        if (role === 'director') return t('library.directorName', 'Yönetmen');
        if (role === 'actor') return t('detail.actor', 'Oyuncu');
        if (role === 'genre') return t('detail.genre', 'Tür'); // Added fallback for potential missing key
        if (role === 'year') return t('detail.year', 'Yıl');
        return '';
    };

    return (
        <View className="flex-1 bg-white dark:bg-gray-950">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-4 pb-4 border-b border-gray-100 dark:border-gray-900" style={{ paddingTop: insets.top + 10 }}>
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
                    >
                        <Icon name="arrow-left" size={24} color="#374151" />
                    </TouchableOpacity>
                    <View className="ml-4 flex-1">
                        <Text className="text-xs text-blue-500 font-bold uppercase tracking-wider">{getHeaderLabel()}</Text>
                        <Text className="text-xl font-bold text-gray-900 dark:text-white" numberOfLines={1}>{name}</Text>
                    </View>
                </View>
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : (
                <FlatList
                    data={movies}
                    renderItem={renderMovieItem}
                    keyExtractor={(item) => `${role}-movie-${item.id}`}
                    numColumns={COLUMN_COUNT}
                    contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
                    onEndReached={() => {
                        if (hasNextPage && !isFetchingNextPage) {
                            fetchNextPage();
                        }
                    }}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <View className="py-4">
                                <ActivityIndicator size="small" color="#3B82F6" />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center py-20">
                            <Icon name="movie-off-outline" size={64} color="#9CA3AF" />
                            <Text className="text-gray-500 dark:text-gray-400 mt-4 text-center">
                                {t('search.noResults', 'Sonuç bulunamadı.')}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};
