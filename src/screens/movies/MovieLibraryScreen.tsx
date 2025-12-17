import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pb } from '../../services/pocketbase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AIStatusBadge } from '../../components/AIStatusBadge';

export interface Movie {
    id: string;
    collectionId: string;
    collectionName: string;
    created: string;
    updated: string;
    title: string;
    director: string;
    poster_url: string;
    release_date: string;
    enrichment_status: 'pending' | 'processing' | 'completed' | 'failed';
    tmdb_id: string;
    description?: string;
    ai_notes?: string;
    in_library?: boolean;
    is_archived?: boolean;
    certification?: string;
    type?: 'movie' | 'tv';
    vibe_status?: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
    vibes?: string[];
    mood_color?: string;
    ai_summary?: string;
}

export const MovieLibraryScreen = () => {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [manualTitle, setManualTitle] = useState('');
    const [manualDirector, setManualDirector] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: movies, isLoading, error, refetch } = useQuery({
        queryKey: ['movies'],
        queryFn: async () => {
            return await pb.collection('movies').getFullList<Movie>({
                sort: '-created',
            });
        },
    });

    const addManualMovieMutation = useMutation({
        mutationFn: async () => {
            const data = {
                title: manualTitle,
                director: manualDirector,
                poster_url: '',
                status: 'want_to_watch',
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

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await pb.collection('movies').delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['movies'] });
        },
        onError: (err) => {
            Alert.alert(t('common.error'), t('common.deleteError', 'Silme işlemi başarısız oldu.'));
        }
    });

    const handleDelete = (id: string, title: string) => {
        Alert.alert(
            t('common.delete', 'Sil'),
            t('common.deleteConfirmation', '"{title}" filmini silmek istediğinize emin misiniz?', { title }),
            [
                { text: t('common.cancel', 'İptal'), style: 'cancel' },
                {
                    text: t('common.delete', 'Sil'),
                    style: 'destructive',
                    onPress: () => deleteMutation.mutate(id)
                }
            ]
        );
    };

    useEffect(() => {
        const unsubscribe = pb.collection('movies').subscribe('*', (e) => {
            if (e.action === 'create' || e.action === 'delete' || e.action === 'update') {
                queryClient.invalidateQueries({ queryKey: ['movies'] });
            }
        });

        return () => {
            unsubscribe.then((unsub) => unsub());
        };
    }, [queryClient]);

    const renderItem = ({ item }: { item: Movie }) => {
        // Sadece gecerli URL'leri kabul et
        let posterUrl: string | null = null;
        if (item.poster_url && item.poster_url.startsWith('https://')) {
            posterUrl = item.poster_url;
        } else if (item.poster_url && item.poster_url.startsWith('http://')) {
            posterUrl = item.poster_url.replace('http://', 'https://');
        }
        // "undefined" string, bos string, null/undefined -> posterUrl kalir null

        return (
            <TouchableOpacity
                onPress={() => navigation.navigate('MovieDetail', { movieId: item.id, mediaType: (item.type === 'tv' || (item as any).media_type === 'tv') ? 'tv' : 'movie' })}
                className="flex-row bg-white dark:bg-gray-800 p-3 mb-2 mx-4 rounded-xl shadow-sm items-center"
            >
                {/* Left: Small Poster Image */}
                <View className="w-10 h-16 mr-3 shadow-sm bg-gray-200 dark:bg-gray-700 rounded-sm overflow-hidden">
                    {posterUrl ? (
                        <Image
                            source={{ uri: posterUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center">
                            <Icon name="movie-open" size={20} color="#9CA3AF" />
                        </View>
                    )}
                </View>

                {/* Right: Info */}
                <View className="flex-1 justify-center mr-2">
                    <View className="flex-row items-center mb-0.5">
                        <Text className="text-base font-bold text-gray-900 dark:text-white flex-shrink" numberOfLines={1}>
                            {item.title}
                        </Text>
                    </View>

                    <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1" numberOfLines={1}>
                        {item.director}
                    </Text>

                    {/* Status & Icons Row */}
                    <View className="flex-row items-center mt-1 flex-wrap gap-2">
                        {/* Certification Badge */}
                        {item.certification ? (
                            <View className="bg-transparent border border-gray-300 dark:border-gray-600 px-1.5 py-0.5 rounded">
                                <Text className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                    {item.certification}
                                </Text>
                            </View>
                        ) : null}

                        {/* Media Type Badge */}
                        {(item.type === 'tv' || (item as any).media_type === 'tv_show' || (item as any).media_type === 'tv') ? (
                            <View className="bg-blue-600 px-1.5 py-0.5 rounded">
                                <Text className="text-[9px] font-bold text-white">DİZİ</Text>
                            </View>
                        ) : (
                            <View className="bg-orange-500 px-1.5 py-0.5 rounded">
                                <Text className="text-[9px] font-bold text-white">FİLM</Text>
                            </View>
                        )}
                    </View>
                </View >
            </TouchableOpacity >
        );
    };

    return (
        <View
            className="flex-1 bg-gray-50 dark:bg-gray-900"
            style={{ paddingTop: insets.top }}
        >
            {/* Header */}
            <View className="p-4 bg-white dark:bg-gray-800 shadow-sm z-10">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {t('library.moviesTitle', 'Film Arşivi')}
                </Text>
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                    <Icon name="magnify" size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-2 text-gray-900 dark:text-white"
                        placeholder={t('library.searchMoviePlaceholder', 'Film veya yönetmen ara...')}
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Icon name="close-circle" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : error ? (
                <View className="flex-1 items-center justify-center p-4">
                    <Icon name="alert-circle-outline" size={48} color="#EF4444" />
                    <Text className="text-gray-600 dark:text-gray-400 text-center mt-2">
                        {t('common.error', 'Bir hata oluştu')}
                    </Text>
                    <TouchableOpacity onPress={() => refetch()} className="mt-4 bg-blue-600 px-4 py-2 rounded-lg">
                        <Text className="text-white font-semibold">{t('common.retry', 'Tekrar Dene')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlashList<Movie>
                    data={movies?.filter(movie => {
                        const query = searchQuery.toLowerCase();
                        const director = movie.director || '';
                        return (
                            movie.title.toLowerCase().includes(query) ||
                            director.toLowerCase().includes(query)
                        );
                    }) || []}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    estimatedItemSize={88}
                    contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#3B82F6" />
                    }
                    ListEmptyComponent={
                        <View className="items-center justify-center mt-20 px-4">
                            <Icon name="movie-roll" size={64} color="#D1D5DB" />
                            <Text className="text-gray-500 dark:text-gray-400 text-center mt-4 text-lg">
                                {t('library.emptyMovies', 'Film arşiviniz boş')}
                            </Text>
                            <Text className="text-gray-400 dark:text-gray-500 text-center mt-2 text-sm">
                                {t('library.emptyMoviesDescription', 'İzlemek istediğiniz filmleri ekleyin')}
                            </Text>
                        </View>
                    }
                />
            )}



            {/* Manual Add Modal */}
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
                            placeholder={t('library.movieTitlePlaceholder', 'Örn: The Godfather')}
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
                            placeholder={t('library.directorPlaceholder', 'Örn: Francis Ford Coppola')}
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
