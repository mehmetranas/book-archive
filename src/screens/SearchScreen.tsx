import React, { useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, TouchableOpacity, Alert, Image, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import { useGoogleBooks, GoogleBookItem } from '../hooks/useGoogleBooks';
import { pb } from '../services/pocketbase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const SearchScreen = () => {
    const { t, i18n } = useTranslation();
    const [query, setQuery] = useState('');
    const { data: books, isLoading, error } = useGoogleBooks(query);
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [manualTitle, setManualTitle] = useState('');
    const [manualAuthor, setManualAuthor] = useState('');

    const addBookMutation = useMutation({
        mutationFn: async (book: GoogleBookItem) => {
            const volumeInfo = book.volumeInfo;

            // Extract high quality image if available, otherwise fallback
            let coverUrl = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || '';
            if (coverUrl.startsWith('http://')) {
                coverUrl = coverUrl.replace('http://', 'https://');
            }

            // Extract ISBN
            const isbnIdentifier = volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')
                || volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10');
            const isbn = isbnIdentifier?.identifier || '';

            const data = {
                title: volumeInfo.title,
                authors: volumeInfo.authors || [],
                google_books_id: book.id,
                cover_url: coverUrl,
                language_code: i18n.language, // 'tr' or 'en'
                user: pb.authStore.record?.id,
                status: 'want_to_read',
                enrichment_status: 'pending',
                isbn: isbn,
            };

            return await pb.collection('books').create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['books'] });
            Alert.alert(t('common.success'), t('search.bookAdded'));
        },
        onError: (err: any) => {
            console.error('Add book error:', err);
            const errorMessage = err?.data?.message || err?.message || t('search.addFailed');
            const validationErrors = err?.data?.data ? JSON.stringify(err.data.data, null, 2) : '';
            Alert.alert(t('common.error'), `${errorMessage}\n${validationErrors}`);
        },
    });

    const addManualBookMutation = useMutation({
        mutationFn: async () => {
            const data = {
                title: manualTitle,
                authors: manualAuthor ? [manualAuthor] : [],
                cover_url: '',
                status: 'want_to_read',
                enrichment_status: 'pending',
                language_code: i18n.language,
                user: pb.authStore.record?.id,
            };
            return await pb.collection('books').create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['books'] });
            setIsModalVisible(false);
            setManualTitle('');
            setManualAuthor('');
            Alert.alert(t('common.success'), t('library.manualAddSuccess', 'Kitap eklendi, yapay zeka detayları araştırıyor...'));
        },
        onError: (err: any) => {
            console.error('Manual add error:', err);
            Alert.alert(t('common.error'), t('library.manualAddError', 'Kitap eklenirken bir hata oluştu.'));
        }
    });

    const handleManualAdd = () => {
        if (!manualTitle.trim()) {
            Alert.alert(t('common.warning'), t('library.titleRequired', 'Kitap adı zorunludur.'));
            return;
        }
        addManualBookMutation.mutate();
    };

    const renderItem = ({ item }: { item: GoogleBookItem }) => {
        const { volumeInfo } = item;
        const coverUrl = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail;

        const isAdding = addBookMutation.isPending && addBookMutation.variables?.id === item.id;

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
                    disabled={isAdding}
                >
                    {isAdding ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Text className="text-white font-semibold">{t('common.add')}</Text>
                    )}
                </TouchableOpacity>
            </View>
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
                        {t('search.title')}
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
                        placeholder={t('search.placeholder')}
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
                    data={books || []}
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
                            {t('library.manualAddTitle', 'Manuel Kitap Ekle')}
                        </Text>

                        <Text className="text-gray-700 dark:text-gray-300 mb-1 font-medium">
                            {t('library.bookTitle', 'Kitap Adı')} *
                        </Text>
                        <TextInput
                            className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700"
                            placeholder={t('library.titlePlaceholder', 'Örn: Sefiller')}
                            placeholderTextColor="#9CA3AF"
                            value={manualTitle}
                            onChangeText={setManualTitle}
                            autoCorrect={false}
                        />

                        <Text className="text-gray-700 dark:text-gray-300 mb-1 font-medium">
                            {t('library.authorName', 'Yazar Adı')}
                        </Text>
                        <TextInput
                            className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-6 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700"
                            placeholder={t('library.authorPlaceholder', 'Örn: Victor Hugo')}
                            placeholderTextColor="#9CA3AF"
                            value={manualAuthor}
                            onChangeText={setManualAuthor}
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
                                disabled={addManualBookMutation.isPending}
                            >
                                {addManualBookMutation.isPending ? (
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

