import React, { useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, TouchableOpacity, Alert, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import { useGoogleBooks, GoogleBookItem } from '../hooks/useGoogleBooks';
import { pb } from '../services/pocketbase';
import { useMutation } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export const SearchScreen = () => {
    const { t, i18n } = useTranslation();
    const [query, setQuery] = useState('');
    const { data: books, isLoading, error } = useGoogleBooks(query);

    const addBookMutation = useMutation({
        mutationFn: async (book: GoogleBookItem) => {
            const volumeInfo = book.volumeInfo;

            // Extract high quality image if available, otherwise fallback
            const coverUrl = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || '';

            const data = {
                title: volumeInfo.title,
                authors: volumeInfo.authors || [],
                google_books_id: book.id,
                cover_url: coverUrl,
                language_code: i18n.language, // 'tr' or 'en'
                user: pb.authStore.record?.id,
                status: 'want_to_read',
            };

            return await pb.collection('books').create(data);
        },
        onSuccess: () => {
            Alert.alert(t('common.success'), t('search.bookAdded'));
        },
        onError: (err: any) => {
            console.error('Add book error:', err);
            const errorMessage = err?.data?.message || err?.message || t('search.addFailed');
            const validationErrors = err?.data?.data ? JSON.stringify(err.data.data, null, 2) : '';
            Alert.alert(t('common.error'), `${errorMessage}\n${validationErrors}`);
        },
    });

    const renderItem = ({ item }: { item: GoogleBookItem }) => {
        const { volumeInfo } = item;
        const coverUrl = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail;

        return (
            <View className="flex-row bg-white dark:bg-gray-800 p-4 mb-3 rounded-xl shadow-sm items-center">
                {coverUrl ? (
                    <Image
                        source={{ uri: coverUrl }}
                        className="w-16 h-24 rounded-md mr-4"
                        resizeMode="cover"
                    />
                ) : (
                    <View className="w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded-md mr-4 items-center justify-center">
                        <Icon name="book-open-variant" size={24} color="#9CA3AF" />
                    </View>
                )}

                <View className="flex-1 mr-2">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-1" numberOfLines={2}>
                        {volumeInfo.title}
                    </Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400" numberOfLines={1}>
                        {volumeInfo.authors?.join(', ') || t('search.unknownAuthor')}
                    </Text>
                </View>

                <TouchableOpacity
                    className="bg-blue-600 px-4 py-2 rounded-lg"
                    onPress={() => addBookMutation.mutate(item)}
                    disabled={addBookMutation.isPending}
                >
                    {addBookMutation.isPending ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Text className="text-white font-semibold">{t('common.add')}</Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-gray-50 dark:bg-gray-900">
            <View className="p-4 bg-white dark:bg-gray-800 shadow-sm z-10">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {t('search.title')}
                </Text>
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-4 border border-gray-200 dark:border-gray-600">
                    <Icon name="magnify" size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 py-3 px-2 text-gray-900 dark:text-white text-base"
                        placeholder={t('search.placeholder')}
                        placeholderTextColor="#9CA3AF"
                        value={query}
                        onChangeText={setQuery}
                        autoCapitalize="none"
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
                    <ActivityIndicator size="large" color="#2563EB" />
                </View>
            ) : error ? (
                <View className="flex-1 items-center justify-center p-4">
                    <Icon name="alert-circle-outline" size={48} color="#EF4444" />
                    <Text className="text-gray-600 dark:text-gray-400 text-center mt-2">
                        {t('search.error')}
                    </Text>
                </View>
            ) : (
                <FlashList<GoogleBookItem>
                    data={books}
                    renderItem={renderItem}
                    estimatedItemSize={120}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        query.length > 0 ? (
                            <View className="items-center justify-center mt-10">
                                <Text className="text-gray-500 dark:text-gray-400">
                                    {t('search.noResults')}
                                </Text>
                            </View>
                        ) : null
                    }
                />
            )}
        </View>
    );
};

