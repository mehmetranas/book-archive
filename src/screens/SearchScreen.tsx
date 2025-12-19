import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ActivityIndicator, TouchableOpacity, Alert, Image, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import axios from 'axios';
import { useGoogleBooks, GoogleBookItem } from '../hooks/useGoogleBooks';
import { pb } from '../services/pocketbase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';

import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export const SearchScreen = () => {
    const { t, i18n } = useTranslation();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const [query, setQuery] = useState('');
    const { data: books, isLoading, error } = useGoogleBooks(query);
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [manualTitle, setManualTitle] = useState('');
    const [manualAuthor, setManualAuthor] = useState('');

    // --- AI Recommendation State ---
    const [isAIModalVisible, setIsAIModalVisible] = useState(false);
    const [aiQuery, setAIQuery] = useState('');
    const [aiResults, setAiResults] = useState<any[] | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [addingAIItemId, setAddingAIItemId] = useState<string | null>(null);

    // Get user from AuthContext
    const { user } = useAuth();

    // Refresh user data (credits) when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            if (user?.id) {
                pb.collection('users').getOne(user.id)
                    .then((updatedRecord) => {
                        // Update the auth store with fresh data. 
                        // This will trigger the onChange listener in AuthContext and update 'user' state everywhere.
                        if (pb.authStore.isValid && pb.authStore.token) {
                            pb.authStore.save(pb.authStore.token, updatedRecord);
                        }
                    })
                    .catch((err) => console.log("Failed to refresh user credits:", err));
            }
        }, [user?.id])
    );

    useEffect(() => {
        if (route.params?.scannedIsbn) {
            setQuery(`isbn:${route.params.scannedIsbn}`);
            navigation.setParams({ scannedIsbn: undefined });
        }
    }, [route.params?.scannedIsbn]);

    // Reset mutation state (green checkmark) when leaving the screen
    useFocusEffect(
        useCallback(() => {
            return () => {
                addBookMutation.reset();
            };
        }, [])
    );

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
                isbn: isbn,
                page_count: volumeInfo.pageCount || 0,
                enrichment_status: (pb.authStore.model?.settings?.auto_ai_enrichment) ? 'pending' : 'none',
            };

            return await pb.collection('books').create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['books'] });
            // Alert removed for visual feedback
        },
        onError: (err: any) => {
            console.error('Add book error:', err);
            const errorMessage = err?.data?.message || err?.message || t('search.addFailed');
            const validationErrors = err?.data?.data ? JSON.stringify(err.data.data, null, 2) : '';
            Alert.alert(t('common.error'), `${errorMessage}\n${validationErrors}`);
        },
    });

    const aiRecommendMutation = useMutation({
        mutationFn: async (userQuery: string) => {
            // Check token
            if (!pb.authStore.isValid) {
                console.log("AuthStore invalid!", pb.authStore.token);
                throw new Error("User not authenticated properly");
            }

            // Explicitly set Content-Type, leave Authorization to SDK (which adds Bearer)
            const res = await pb.send("/api/ai/recommend-books", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: { query: userQuery }
            });
            return res;
        },
        onSuccess: (data: any) => {
            if (data.error === "OFF_TOPIC") {
                setAiError(data.message || t('search.aiOffTopic', 'Konu dışı istek.'));
                setAiResults(null);
            } else if (data.recommendations) {
                setAiResults(data.recommendations);
                setAiError(null);

                // Update local user credits
                if (data.remainingCredits !== undefined && pb.authStore.model) {
                    const updatedModel = { ...pb.authStore.model, credits: data.remainingCredits };
                    pb.authStore.save(pb.authStore.token, updatedModel);
                }
            }
        },
        onError: (err: any) => {
            console.log("AI Error:", err);
            if (err?.status === 402 || err?.data?.error === "INSUFFICIENT_CREDITS") {
                setAiError("Yetersiz bakiye. Lütfen kredi yükleyin.");
            } else {
                setAiError(t('common.error'));
            }
        }
    });

    const handleAISelect = (book: any) => {
        // Use ISBN if available for better accuracy, else Title + Author
        // Note: We do NOT clear setAiResults here, so user can open modal again to see same suggestions
        const searchQuery = book.isbn ? `isbn:${book.isbn}` : `${book.title} ${book.author}`;
        setQuery(searchQuery);
        setIsAIModalVisible(false);
    };

    const handleAIClear = () => {
        setAIQuery('');
        setAiResults(null);
        setAiError(null);
    };

    // --- Mock Purchase Function for now ---
    const handleBuyCredits = async () => {
        try {
            if (!user) return;

            Alert.alert(
                "Test Mağazası",
                "Bu bir test sürümüdür. Ücretsiz kredi yüklemek ister misiniz?",
                [
                    { text: "İptal", style: "cancel" },
                    {
                        text: "10 Kredi Yükle (Ücretsiz)",
                        onPress: async () => {
                            try {
                                const res = await pb.send("/api/mock/buy-credits", {
                                    method: "POST",
                                    body: { amount: 10 }
                                });

                                if (res.success) {
                                    Alert.alert("Başarılı", res.message);
                                    // Update local user state immediately
                                    if (pb.authStore.model) {
                                        const updatedModel = { ...pb.authStore.model, credits: res.credits };
                                        pb.authStore.save(pb.authStore.token, updatedModel);
                                        // Force UI update if needed (AuthContext usually listens to onChange)
                                    }
                                }
                            } catch (err: any) {
                                Alert.alert("Hata", "Kredi yüklenemedi: " + err.message);
                            }
                        }
                    }
                ]
            );
        } catch (e) {
            console.error(e);
        }
    };

    const addManualBookMutation = useMutation({
        mutationFn: async () => {
            const data = {
                title: manualTitle,
                authors: manualAuthor ? [manualAuthor] : [],
                cover_url: '',
                status: 'want_to_read',
                language_code: i18n.language,
                user: pb.authStore.record?.id,
                enrichment_status: (pb.authStore.model?.settings?.auto_ai_enrichment) ? 'pending' : 'none',
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
        const isSuccess = addBookMutation.isSuccess && addBookMutation.variables?.id === item.id;

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
                    className={`${isSuccess ? 'bg-green-500' : 'bg-blue-600'} w-10 h-10 rounded-full items-center justify-center shadow-sm`}
                    onPress={() => addBookMutation.mutate(item)}
                    disabled={isAdding || isSuccess}
                >
                    {isAdding ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : isSuccess ? (
                        <Icon name="check" size={24} color="white" />
                    ) : (
                        <Icon name="plus" size={24} color="white" />
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
                    <View className="flex-row gap-2">
                        {/* AI Button */}
                        <TouchableOpacity
                            onPress={() => setIsAIModalVisible(true)}
                            className="bg-purple-600 p-2 rounded-full"
                        >
                            <Icon name="creation" size={24} color="white" />
                        </TouchableOpacity>

                        {/* Manual Add Button */}
                        <TouchableOpacity
                            onPress={() => setIsModalVisible(true)}
                            className="bg-blue-600 p-2 rounded-full"
                        >
                            <Icon name="plus" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
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
                    <TouchableOpacity
                        onPress={() => navigation.navigate('BarcodeScanner')}
                        className="ml-2 pl-2 border-l border-gray-300 dark:border-gray-600"
                    >
                        <Icon name="barcode-scan" size={24} color="#6B7280" />
                    </TouchableOpacity>
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
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        query.length > 0 ? (
                            <View className="items-center justify-center mt-10">
                                <Text className="text-gray-500 dark:text-gray-400">
                                    {t('search.noResults')}
                                </Text>
                            </View>
                        ) : (
                            <View className="flex-1 items-center justify-center mt-20 opacity-50">
                                <Icon name="google" size={64} color="#4B5563" />
                                <Text className="text-gray-500 dark:text-gray-400 text-lg font-medium mt-4">
                                    Google Books
                                </Text>
                                <Text className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                                    {t('search.poweredBy', 'ile güçlendirilmiştir')}
                                </Text>
                            </View>
                        )
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

            {/* AI Recommendation Modal */}
            <Modal
                visible={isAIModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsAIModalVisible(false)}
            >
                <View className="flex-1 bg-white dark:bg-gray-900">
                    <View className="p-4 border-b border-gray-200 dark:border-gray-800 flex-row justify-between items-center">
                        <Text className="text-xl font-bold text-gray-900 dark:text-white flex-row items-center">
                            <Icon name="creation" size={24} color="#9333EA" /> AI Kütüphaneci
                        </Text>
                        <TouchableOpacity onPress={() => setIsAIModalVisible(false)} className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full">
                            <Icon name="close" size={24} color="#4B5563" />
                        </TouchableOpacity>
                    </View>

                    <View className="p-4 flex-1">
                        {/* Credits Banner */}
                        <View className="flex-row items-center justify-between bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl mb-4">
                            <View className="flex-row items-center">
                                <Icon name="bitcoin" size={20} color="#9333EA" className="mr-2" />
                                <Text className="text-purple-900 dark:text-purple-100 font-bold">
                                    Krediniz: {user?.credits ?? 0}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={handleBuyCredits} className="bg-purple-600 px-3 py-1.5 rounded-lg">
                                <Text className="text-white text-xs font-bold">Kredi Al</Text>
                            </TouchableOpacity>
                        </View>

                        {!aiResults ? (
                            <>
                                <Text className="text-gray-600 dark:text-gray-300 mb-2">
                                    Nasıl bir kitap arıyorsunuz? (Konu, his, tarz...)
                                </Text>
                                <TextInput
                                    className={`border border-gray-300 dark:border-gray-700 rounded-xl p-4 mb-4 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 min-h-[100px] ${aiRecommendMutation.isPending ? 'opacity-50' : ''}`}
                                    placeholder="Örn: Sürükleyici bir polisiye ama içinde aşk olmasın..."
                                    placeholderTextColor="#9CA3AF"
                                    value={aiQuery}
                                    onChangeText={setAIQuery}
                                    multiline
                                    textAlignVertical="top"
                                    editable={!aiRecommendMutation.isPending}
                                />

                                {aiError && (
                                    <View className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-4 flex-row items-center">
                                        <Icon name="alert-circle" size={20} color="#DC2626" className="mr-2" />
                                        <Text className="text-red-700 dark:text-red-300 flex-1">{aiError}</Text>
                                        {aiError.includes("bakiye") && (
                                            <TouchableOpacity onPress={handleBuyCredits} className="bg-red-100 dark:bg-red-800 ml-2 px-2 py-1 rounded">
                                                <Text className="text-red-800 dark:text-white text-xs font-bold">Al</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={() => aiRecommendMutation.mutate(aiQuery)}
                                    disabled={aiRecommendMutation.isPending || aiQuery.length < 5 || (user?.credits ?? 0) < 1}
                                    className={`w-full py-4 rounded-xl flex-row items-center justify-center shadow-md ${(user?.credits ?? 0) < 1
                                        ? 'bg-gray-400 opacity-50'
                                        : aiRecommendMutation.isPending || aiQuery.length < 5
                                            ? 'bg-purple-400'
                                            : 'bg-purple-600'
                                        }`}
                                >
                                    {aiRecommendMutation.isPending ? (
                                        <>
                                            <ActivityIndicator size="small" color="white" className="mr-2" />
                                            <Text className="text-white font-bold">Düşünülüyor...</Text>
                                        </>
                                    ) : (user?.credits ?? 0) < 1 ? (
                                        <>
                                            <Icon name="lock" size={20} color="white" className="mr-2" />
                                            <Text className="text-white font-bold">Yetersiz Kredi</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="creation" size={20} color="white" className="mr-2" />
                                            <Text className="text-white font-bold">Önerileri Bul (1 Kredi)</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <View className="mt-8 items-center opacity-50">
                                    <Icon name="robot" size={64} color="#9CA3AF" />
                                    <Text className="text-gray-400 text-center mt-2 max-w-[250px]">
                                        Yapay zeka, tarifinize en uygun 3 kitabı seçip size sunacaktır.
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View className="flex-1">
                                <TouchableOpacity
                                    onPress={handleAIClear}
                                    className="flex-row items-center mb-4"
                                >
                                    <Icon name="arrow-left" size={20} color="#6B7280" />
                                    <Text className="text-gray-500 ml-1">Yeni Arama</Text>
                                </TouchableOpacity>

                                <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                    Sizin için seçtiklerim:
                                </Text>

                                <FlashList
                                    data={aiResults}
                                    renderItem={({ item }: { item: any }) => (
                                        <View className="bg-white dark:bg-gray-800 p-4 rounded-xl mb-4 border border-gray-100 dark:border-gray-700 shadow-sm">
                                            <View className="flex-row justify-between items-start mb-2">
                                                <View className="flex-1">
                                                    <Text className="text-lg font-bold text-gray-900 dark:text-white">{item.title}</Text>
                                                    <Text className="text-gray-600 dark:text-gray-400">{item.author}</Text>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => handleAISelect(item)}
                                                    className="bg-purple-100 dark:bg-purple-900/30 px-3 py-1.5 rounded-lg flex-row items-center"
                                                >
                                                    <Icon name="magnify" size={16} color="#9333EA" className="mr-1" />
                                                    <Text className="text-purple-700 dark:text-purple-300 font-bold text-xs">Ara</Text>
                                                </TouchableOpacity>
                                            </View>

                                            <View className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg mb-2">
                                                <Text className="text-purple-800 dark:text-purple-300 text-xs italic">
                                                    "{item.reason}"
                                                </Text>
                                            </View>

                                            <Text className="text-gray-600 dark:text-gray-400 text-sm leading-5">
                                                {item.summary}
                                            </Text>
                                        </View>
                                    )}
                                />
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};
