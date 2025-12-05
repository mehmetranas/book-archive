import React, { useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, TouchableOpacity, Alert, Image, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDebounce } from '../../hooks/useDebounce';
import { useSearchMovies } from '../../hooks/useTMDB';
import { addMovieToLibrary, Movie } from '../../services/tmdb';
import { pb } from '../../services/pocketbase';

export const MovieSearchScreen = () => {
    const { t, i18n } = useTranslation();
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 500);
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const navigation = useNavigation<any>(); // Assuming any for now to simplify

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [manualTitle, setManualTitle] = useState('');
    const [manualDirector, setManualDirector] = useState('');

    const { data: searchResult, isLoading, error } = useSearchMovies(debouncedQuery);

    const addMovieMutation = useMutation({
        mutationFn: addMovieToLibrary,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['movies'] });
            Alert.alert(t('common.success'), t('search.movieAdded', 'Film kütüphaneye eklendi'));
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
                poster_path: '',
                // status: 'want_to_watch', // Removed
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

    const renderItem = ({ item }: { item: Movie }) => {
        const posterUrl = item.poster_path
            ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
            : null;

        const year = item.release_date ? item.release_date.split('-')[0] : '';
        const isAdding = addMovieMutation.isPending && addMovieMutation.variables?.id === item.id;

        return (
            <TouchableOpacity
                className="flex-row bg-white dark:bg-gray-800 p-3 mb-3 rounded-xl shadow-sm items-center"
                onPress={() => {
                    navigation.navigate('MovieDetail', { tmdbId: item.id });
                }}
            >
                <View className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded-md mr-4 overflow-hidden shadow-sm">
                    {posterUrl ? (
                        <Image
                            source={{ uri: posterUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center">
                            <Icon name="movie-open" size={24} color="#9CA3AF" />
                        </View>
                    )}
                </View>

                <View className="flex-1 mr-2">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white" numberOfLines={2}>
                        {item.title}
                    </Text>
                    {year ? (
                        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {year}
                        </Text>
                    ) : null}
                    <View className="flex-row items-center mt-1">
                        <Icon name="star" size={14} color="#F59E0B" />
                        <Text className="text-xs text-gray-600 dark:text-gray-300 ml-1">
                            {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    className="bg-blue-600 px-4 py-2 rounded-lg"
                    onPress={() => addMovieMutation.mutate(item)}
                    disabled={isAdding}
                >
                    {isAdding ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Text className="text-white font-semibold text-sm">
                            {t('common.add', 'Ekle')}
                        </Text>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View
            className="flex-1 bg-gray-50 dark:bg-gray-900"
            style={{ paddingTop: insets.top }}
        >
            <View className="p-4 bg-white dark:bg-gray-800 shadow-sm z-10">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                        {t('search.movieTitle', 'Film Ara')}
                    </Text>
                    <TouchableOpacity
                        onPress={() => setIsModalVisible(true)}
                        className="bg-blue-600 p-2 rounded-full"
                    >
                        <Icon name="plus" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-4 border border-gray-200 dark:border-gray-600">
                    <Icon name="magnify" size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 py-3 px-2 text-gray-900 dark:text-white text-base"
                        placeholder={t('search.moviePlaceholder', 'Film ara...')}
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

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : (
                <FlashList<Movie>
                    data={searchResult?.results || []}
                    renderItem={renderItem}
                    estimatedItemSize={120}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center p-6 mt-10">
                            {debouncedQuery.length > 2 ? (
                                <>
                                    <Icon name="movie-search-outline" size={64} color="#D1D5DB" />
                                    <Text className="text-gray-500 dark:text-gray-400 text-center mt-4 text-lg">
                                        {t('search.noResults', 'Sonuç bulunamadı')}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Icon name="movie-roll" size={64} color="#D1D5DB" />
                                    <Text className="text-gray-500 dark:text-gray-400 text-center mt-4 text-lg">
                                        {t('search.startTyping', 'Film aramak için yazmaya başlayın')}
                                    </Text>
                                    <Text className="text-gray-400 dark:text-gray-500 text-center mt-2 text-sm">
                                        {t('search.tmdbPowered', 'TMDB ile güçlendirilmiştir')}
                                    </Text>
                                </>
                            )}
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
