import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert, ActionSheetIOS, Platform, AlertButton, RefreshControl } from 'react-native';
import Share from 'react-native-share';
import RNFetchBlob from 'rn-fetch-blob';

import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pb } from '../services/pocketbase';
import { Book } from './LibraryScreen';
import { AIStatusBadge } from '../components/AIStatusBadge';
import { CharacterCard } from '../components/CharacterCard';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface GlobalBook {
    id: string;
    title: string;
    character_analysis_status: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
    character_map?: any;
}

export const BookDetailScreen = () => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const route = useRoute();
    const navigation = useNavigation();
    const queryClient = useQueryClient();
    const { bookId } = route.params as { bookId: string };

    useEffect(() => {
        const unsubscribe = pb.collection('books').subscribe(bookId, (e) => {
            if (e.action === 'update') {
                queryClient.invalidateQueries({ queryKey: ['book', bookId] });
                queryClient.invalidateQueries({ queryKey: ['books'] });
            }
        });

        return () => {
            unsubscribe.then((unsub) => unsub());
        };
    }, [bookId, queryClient]);

    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [editedAuthor, setEditedAuthor] = useState('');
    const [editedIsbn, setEditedIsbn] = useState('');
    const [editedDescription, setEditedDescription] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const { data: book, isLoading, refetch } = useQuery({
        queryKey: ['book', bookId],
        queryFn: async () => {
            return await pb.collection('books').getOne<Book>(bookId);
        },
    });

    // Global Book Logic
    const { data: globalBook, refetch: refetchGlobalBook } = useQuery({
        queryKey: ['global_book', book?.title],
        queryFn: async () => {
            const title = book?.title;
            if (!title) return null;
            try {
                // Escape quotes in title to prevent filter syntax errors
                const safeTitle = title.replace(/"/g, '\\"');
                return await pb.collection('global_books').getFirstListItem<GlobalBook>(`title="${safeTitle}"`);
            } catch (err: any) {
                return null;
            }
        },
        enabled: !!book?.title,
    });

    const analyzeCharacterMutation = useMutation({
        mutationFn: async () => {
            if (!book?.title) return;

            if (globalBook) {
                return await pb.collection('global_books').update(globalBook.id, {
                    character_analysis_status: 'pending'
                });
            } else {
                return await pb.collection('global_books').create({
                    title: book.title,
                    character_analysis_status: 'pending'
                });
            }
        },
        onSuccess: () => {
            refetchGlobalBook();
            Alert.alert(t('common.success'), t('detail.analysisStarted', 'Analiz başlatıldı.'));
        },
        onError: (err: any) => {
            Alert.alert(t('common.error'), err.message);
        }
    });

    useEffect(() => {
        if (!book?.title) return;
        const unsubscribe = pb.collection('global_books').subscribe('*', (e) => {
            if (e.record.title === book.title) {
                queryClient.invalidateQueries({ queryKey: ['global_book', book.title] });
            }
        });
        return () => { unsubscribe.then((unsub) => unsub()); };
    }, [book?.title, queryClient]);

    // Invalidate cache on mount to ensure fresh data
    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: ['book', bookId] });
    }, [bookId, queryClient]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    useEffect(() => {
        if (book && !isEditing) {
            setEditedTitle(book.title || '');
            setEditedAuthor(Array.isArray(book.authors) ? book.authors.join(', ') : (book.authors || ''));
            setEditedIsbn(book.isbn || '');
            setEditedDescription(book.description || '');
        }
    }, [book, isEditing]);

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<Book>) => {
            return await pb.collection('books').update(bookId, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['book', bookId] });
            queryClient.invalidateQueries({ queryKey: ['books'] });
            setIsEditing(false);
            Alert.alert(t('common.success'), t('detail.updateSuccess', 'Kitap güncellendi'));
        },
        onError: (err: any) => {
            console.error('Update error:', err);
            const errorMessage = err?.data?.message || err?.message || t('detail.updateError', 'Güncelleme hatası');
            const validationErrors = err?.data?.data ? JSON.stringify(err.data.data, null, 2) : '';
            Alert.alert(t('common.error'), `${errorMessage}\n${validationErrors}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            return await pb.collection('books').delete(bookId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['books'] });
            navigation.goBack();
        },
        onError: (err) => {
            Alert.alert(t('common.error'), t('common.deleteError', 'Silme işlemi başarısız oldu.'));
        }
    });

    const quoteMutation = useMutation({
        mutationFn: async () => {
            return await pb.collection('books').update(bookId, { image_gen_status: 'pending' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['book', bookId] });
            // No alert needed for this background action
        },
        onError: (err: any) => {
            console.error('Quote generation error:', err);
            Alert.alert(t('common.error'), t('common.error'));
        }
    });

    const handleDelete = () => {
        Alert.alert(
            t('common.delete', 'Sil'),
            t('common.deleteConfirmation', 'Bu kitabı silmek istediğinize emin misiniz?'),
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

    const handleSave = () => {
        updateMutation.mutate({
            title: editedTitle,
            authors: editedAuthor.split(',').map(a => a.trim()).filter(a => a.length > 0),
            isbn: editedIsbn,
            description: editedDescription,
        });
    };

    const handleShare = async () => {
        if (!book) return;
        try {
            const authorText = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors;
            const message = `${book.title} - ${authorText}`;
            await Share.open({
                message: message,
            });
        } catch (error: any) {
            console.log('Share error:', error);
        }
    };

    const handleImageShare = async (imageUrl: string) => {
        try {
            // 1. Resmi indir ve Base64'e çevir
            const res = await RNFetchBlob.config({
                fileCache: true
            }).fetch('GET', imageUrl);

            const base64Data = await res.base64();
            const imagePath = `data:image/jpeg;base64,${base64Data}`;

            // 2. Paylaş
            await Share.open({
                title: t('detail.quoteImage', 'Alıntı Resim'),
                message: `${book?.title} - BookVault`,
                url: imagePath,
                type: 'image/jpeg',
                // Instagram Stories için özel ayarlar (Opsiyonel, genelde open ile de çalışır)
                // social: Share.Social.INSTAGRAM
            });

            // Temizlik
            res.flush();

        } catch (error) {
            console.error('Image share error:', error);
            Alert.alert(t('common.error'), t('common.shareError', 'Paylaşım sırasında hata oluştu.'));
        }
    };

    const handleStatusChange = () => {
        const options = ['want_to_read', 'reading', 'read', 'cancel'];
        const labels = [
            t('status.wantToRead', 'Okunacak'),
            t('status.reading', 'Okunuyor'),
            t('status.read', 'Tamamlandı'),
            t('common.cancel', 'İptal')
        ];

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: labels,
                    cancelButtonIndex: 3,
                },
                (buttonIndex) => {
                    if (buttonIndex !== 3) {
                        updateMutation.mutate({ status: options[buttonIndex] });
                    }
                }
            );
        } else {
            // Android fallback using Alert
            const buttons: AlertButton[] = [
                ...options.slice(0, 3).map((opt, index) => ({
                    text: labels[index],
                    onPress: () => updateMutation.mutate({ status: opt })
                })),
                { text: labels[3], style: 'cancel', onPress: () => { } }
            ];

            Alert.alert(
                t('detail.changeStatus', 'Durumu Değiştir'),
                undefined,
                buttons
            );
        }
    };

    if (isLoading || !book) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    const coverUrl = book.cover_url?.startsWith('http://')
        ? book.cover_url.replace('http://', 'https://')
        : book.cover_url;

    return (
        <View
            className="flex-1 bg-gray-50 dark:bg-gray-900"
            style={{ paddingTop: insets.top }}
        >
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm z-10">
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
                    <Icon name="arrow-left" size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1 text-center" numberOfLines={1}>
                    {book.title}
                </Text>
                <View className="w-10" />
            </View>

            {/* Action Bar */}
            <View className="flex-row justify-around p-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <TouchableOpacity
                    onPress={() => isEditing ? handleSave() : setIsEditing(true)}
                    className="items-center"
                    disabled={updateMutation.isPending}
                >
                    <View className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full mb-1">
                        <Icon name={isEditing ? "content-save" : "pencil"} size={20} color="#2563EB" />
                    </View>
                    <Text className="text-xs text-gray-600 dark:text-gray-300">
                        {isEditing ? t('common.save', 'Kaydet') : t('common.edit', 'Düzenle')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => updateMutation.mutate({ in_library: !book.in_library })}
                    className="items-center"
                    disabled={updateMutation.isPending}
                >
                    <View className={`p-2 rounded-full mb-1 ${book.in_library ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <Icon name="bookshelf" size={20} color={book.in_library ? "#166534" : "#4B5563"} />
                    </View>
                    <Text className="text-xs text-gray-600 dark:text-gray-300">
                        {book.in_library ? t('detail.inLibrary', 'Kütüphanede') : t('detail.addToLibrary', 'Kütüphaneye Ekle')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => updateMutation.mutate({ is_archived: !book.is_archived })}
                    className="items-center"
                    disabled={updateMutation.isPending}
                >
                    <View className={`p-2 rounded-full mb-1 ${book.is_archived ? 'bg-orange-100 dark:bg-orange-900' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <Icon name="archive" size={20} color={book.is_archived ? "#C2410C" : "#4B5563"} />
                    </View>
                    <Text className="text-xs text-gray-600 dark:text-gray-300">
                        {book.is_archived ? t('detail.archived', 'Arşivlendi') : t('detail.archive', 'Arşivle')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleDelete}
                    className="items-center"
                    disabled={deleteMutation.isPending}
                >
                    <View className="bg-red-100 dark:bg-red-900 p-2 rounded-full mb-1">
                        <Icon name="trash-can-outline" size={20} color="#DC2626" />
                    </View>
                    <Text className="text-xs text-gray-600 dark:text-gray-300">
                        {t('common.delete', 'Sil')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => updateMutation.mutate({ enrichment_status: 'pending' })}
                    className="items-center"
                    disabled={updateMutation.isPending || (book.enrichment_status !== 'completed' && book.enrichment_status !== 'failed')}
                >
                    <View className={`p-2 rounded-full mb-1 ${book.enrichment_status === 'completed' || book.enrichment_status === 'failed' ? 'bg-purple-100 dark:bg-purple-900' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <Icon name="creation" size={20} color={book.enrichment_status === 'completed' || book.enrichment_status === 'failed' ? "#9333EA" : "#9CA3AF"} />
                    </View>
                    <Text className="text-xs text-gray-600 dark:text-gray-300">
                        {t('detail.regenerateAI', 'AI Yenile')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => quoteMutation.mutate()}
                    className="items-center"
                    disabled={quoteMutation.isPending || (book.image_gen_status === 'pending' || book.image_gen_status === 'processing')}
                >
                    <View className={`p-2 rounded-full mb-1 ${book.image_gen_status === 'pending' || book.image_gen_status === 'processing' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-pink-100 dark:bg-pink-900'}`}>
                        <Icon name="format-quote-close" size={20} color={book.image_gen_status === 'pending' || book.image_gen_status === 'processing' ? "#9CA3AF" : "#DB2777"} />
                    </View>
                    <Text className="text-xs text-gray-600 dark:text-gray-300">
                        {t('detail.quoteImage', 'Alıntı Resim')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleShare}
                    className="items-center"
                >
                    <View className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full mb-1">
                        <Icon name="share-variant" size={20} color="#4B5563" />
                    </View>
                    <Text className="text-xs text-gray-600 dark:text-gray-300">
                        {t('common.share', 'Paylaş')}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1 p-4"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
                }
            >
                {/* ... rest of the content */}
                {/* Book Cover & Basic Info */}
                <View className="flex-row mb-6">
                    <View className="w-32 h-48 shadow-md mr-4">
                        {coverUrl ? (
                            <Image
                                source={{ uri: coverUrl }}
                                className="w-full h-full rounded-lg"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg items-center justify-center">
                                <Icon name="book-open-variant" size={40} color="#9CA3AF" />
                            </View>
                        )}
                    </View>

                    <View className="flex-1 justify-center">
                        {isEditing ? (
                            <View>
                                <TextInput
                                    className="text-xl font-bold text-gray-900 dark:text-white mb-2 border-b border-gray-300 pb-1"
                                    value={editedTitle}
                                    onChangeText={setEditedTitle}
                                    multiline
                                    placeholder={t('detail.titlePlaceholder', 'Kitap Adı')}
                                />
                                <TextInput
                                    className="text-gray-600 dark:text-gray-400 mb-2 border-b border-gray-300 pb-1"
                                    value={editedAuthor}
                                    onChangeText={setEditedAuthor}
                                    placeholder={t('detail.authorPlaceholder', 'Yazar')}
                                />
                                <TextInput
                                    className="text-gray-500 dark:text-gray-500 text-sm mb-4 border-b border-gray-300 pb-1"
                                    value={editedIsbn}
                                    onChangeText={setEditedIsbn}
                                    placeholder="ISBN"
                                    keyboardType="numeric"
                                />
                            </View>
                        ) : (
                            <View>
                                <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                    {book.title}
                                </Text>
                                <Text className="text-gray-600 dark:text-gray-400 mb-1">
                                    {Array.isArray(book.authors) ? book.authors.join(', ') : book.authors}
                                </Text>
                                {book.isbn && (
                                    <Text className="text-gray-500 dark:text-gray-500 text-sm mb-4">
                                        ISBN: {book.isbn}
                                    </Text>
                                )}
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={handleStatusChange}
                            className="bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-lg self-start flex-row items-center"
                        >
                            <Text className="text-blue-700 dark:text-blue-300 font-medium mr-2">
                                {t(`status.${book.status}`, book.status)}
                            </Text>
                            <Icon name="chevron-down" size={16} color="#3B82F6" />
                        </TouchableOpacity>

                        <View className="mt-3">
                            <AIStatusBadge status={book.enrichment_status} showLabel={true} />
                        </View>
                    </View>
                </View>

                {/* Description Section */}
                <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-6">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                        {t('detail.description', 'Özet')}
                    </Text>

                    {isEditing ? (
                        <TextInput
                            className="text-gray-600 dark:text-gray-300 text-base leading-6 min-h-[150px] border border-gray-200 rounded-lg p-2"
                            value={editedDescription}
                            onChangeText={setEditedDescription}
                            multiline
                            textAlignVertical="top"
                        />
                    ) : (
                        <Text className="text-gray-600 dark:text-gray-300 text-base leading-6">
                            {book.description || book.ai_notes || t('detail.noDescription', 'Henüz bir özet yok.')}
                        </Text>
                    )}
                </View>

                {/* Quote Image Section */}
                {book.generated_image && (
                    <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-6">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                            {t('detail.quoteImage', 'Alıntı Resim')}
                        </Text>
                        <View className="aspect-square w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden shadow-sm">
                            <Image
                                source={{ uri: pb.files.getUrl(book, book.generated_image) }}
                                className="w-full h-full"
                                resizeMode="contain"
                            />
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                const url = pb.files.getUrl(book, book.generated_image || '');
                                handleImageShare(url);
                            }}
                            className="mt-3 flex-row items-center justify-center bg-gray-100 dark:bg-gray-700 py-2 rounded-lg"
                        >
                            <Icon name="share-variant" size={18} color="#4B5563" />
                            <Text className="ml-2 text-gray-600 dark:text-gray-300 font-medium">
                                {t('common.share', 'Paylaş')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Character Analysis Section */}
                <View className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-20">
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">
                            {t('detail.characters', 'Karakter Analizi')}
                        </Text>
                        <View className="bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded">
                            <Text className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">AI Powered</Text>
                        </View>
                    </View>

                    {/* Status Handling */}
                    {(() => {
                        // Priority: Global Book -> Local Book
                        const globalStatus = globalBook?.character_analysis_status;
                        const hasGlobalMap = globalBook?.character_map && (
                            Array.isArray(globalBook.character_map) ? globalBook.character_map.length > 0 :
                                (typeof globalBook.character_map === 'string' && globalBook.character_map.length > 5)
                        );

                        const hasLocalMap = book.character_map && book.character_map.length > 0;

                        // Determine effective status
                        let status = globalStatus || 'none';
                        let mapData = globalBook?.character_map;

                        // Fallback mechanism: If global is empty/none but local has data, treat as completed using local data.
                        if ((!status || status === 'none') && hasLocalMap) {
                            status = 'completed';
                            mapData = book.character_map;
                        }

                        if (status === 'none' || status === 'failed') {
                            return (
                                <View className="items-center py-6">
                                    <Icon name="head-snowflake-outline" size={48} color="#E0E7FF" />
                                    <Text className="text-center text-gray-500 dark:text-gray-400 mt-2 mb-4 px-4">
                                        {t('detail.characterAnalysisDesc', 'Yapay zeka bu kitabı okuyarak karakter haritası çıkarabilir.')}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => analyzeCharacterMutation.mutate()}
                                        className="bg-indigo-600 px-6 py-3 rounded-xl flex-row items-center"
                                        disabled={analyzeCharacterMutation.isPending}
                                    >
                                        <Icon name="creation" size={20} color="white" className="mr-2" />
                                        <Text className="text-white font-bold ml-2">
                                            {status === 'failed' ? t('common.retry', 'Tekrar Dene') : t('detail.analyzeCharacters', 'Karakterleri Analiz Et')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        } else if (status === 'pending' || status === 'processing') {
                            return (
                                <View className="items-center py-8">
                                    <ActivityIndicator size="large" color="#4F46E5" />
                                    <Text className="text-indigo-600 dark:text-indigo-400 font-medium mt-4">
                                        {t('detail.analyzing', 'Yapay zeka kitabı okuyor...')}
                                    </Text>
                                    <Text className="text-gray-400 text-xs mt-1">
                                        {t('detail.pleaseWait', 'Lütfen bekleyin, bu işlem birkaç dakika sürebilir.')}
                                    </Text>
                                </View>
                            );
                        } else {
                            // Completed
                            let characters: any[] = [];
                            if (Array.isArray(mapData)) {
                                characters = mapData;
                            } else if (typeof mapData === 'string') {
                                try {
                                    const parsed = JSON.parse(mapData);
                                    if (Array.isArray(parsed)) characters = parsed;
                                } catch (e) {
                                    console.error('Character map parse error:', e);
                                }
                            }

                            if (characters && characters.length > 0) {
                                return (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 py-2">
                                        {characters.map((char: any, index: number) => (
                                            <CharacterCard key={index} character={char} />
                                        ))}
                                    </ScrollView>
                                );
                            } else {
                                return (
                                    <View className="items-center py-4 opacity-60">
                                        <Text className="text-gray-500 dark:text-gray-400">
                                            {t('detail.noCharactersFound', 'Bu kitapta belirgin bir karakter bulunamadı.')}
                                        </Text>
                                    </View>
                                );
                            }
                        }
                    })()}
                </View>
            </ScrollView>
        </View>
    );
};
