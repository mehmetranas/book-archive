import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert, ActionSheetIOS, Platform, AlertButton, RefreshControl, Share } from 'react-native';

import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pb } from '../services/pocketbase';
import { Book } from './LibraryScreen';
import { AIStatusBadge } from '../components/AIStatusBadge';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BookDetailScreen = () => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const route = useRoute();
    const navigation = useNavigation();
    const queryClient = useQueryClient();
    const { bookId } = route.params as { bookId: string };

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
        try {
            const authorText = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors;
            const message = `${book.title} - ${authorText}`;
            await Share.share({
                message: message,
            });
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message);
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
            </ScrollView>
        </View>
    );
};
