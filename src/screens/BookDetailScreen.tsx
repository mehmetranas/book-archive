import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert, ActionSheetIOS, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pb } from '../services/pocketbase';
import { Book } from './LibraryScreen';

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
    const [editedDescription, setEditedDescription] = useState('');

    const { data: book, isLoading, refetch } = useQuery({
        queryKey: ['book', bookId],
        queryFn: async () => {
            return await pb.collection('books').getOne<Book>(bookId);
        },
    });

    useEffect(() => {
        if (book) {
            setEditedTitle(book.title);
            setEditedDescription(book.description || '');
        }
    }, [book]);

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

    const handleSave = () => {
        updateMutation.mutate({
            title: editedTitle,
            description: editedDescription,
        });
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
            Alert.alert(
                t('detail.changeStatus', 'Durumu Değiştir'),
                undefined,
                options.slice(0, 3).map((opt, index) => ({
                    text: labels[index],
                    onPress: () => updateMutation.mutate({ status: opt })
                })).concat([{ text: labels[3], style: 'cancel', onPress: () => { } }])
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
                <TouchableOpacity
                    onPress={() => isEditing ? handleSave() : setIsEditing(true)}
                    className="p-2"
                    disabled={updateMutation.isPending}
                >
                    {updateMutation.isPending ? (
                        <ActivityIndicator size="small" color="#3B82F6" />
                    ) : (
                        <Text className="text-blue-600 font-semibold">
                            {isEditing ? t('common.save', 'Kaydet') : t('common.edit', 'Düzenle')}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4">
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
                            <TextInput
                                className="text-xl font-bold text-gray-900 dark:text-white mb-2 border-b border-gray-300 pb-1"
                                value={editedTitle}
                                onChangeText={setEditedTitle}
                                multiline
                            />
                        ) : (
                            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {book.title}
                            </Text>
                        )}

                        <Text className="text-gray-600 dark:text-gray-400 mb-4">
                            {Array.isArray(book.authors) ? book.authors.join(', ') : book.authors}
                        </Text>

                        <TouchableOpacity
                            onPress={handleStatusChange}
                            className="bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-lg self-start flex-row items-center"
                        >
                            <Text className="text-blue-700 dark:text-blue-300 font-medium mr-2">
                                {t(`status.${book.status}`, book.status)}
                            </Text>
                            <Icon name="chevron-down" size={16} color="#3B82F6" />
                        </TouchableOpacity>
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
                            {book.description || t('detail.noDescription', 'Henüz bir özet yok.')}
                        </Text>
                    )}

                    {book.enrichment_status === 'processing' && (
                        <View className="mt-4 flex-row items-center justify-center bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                            <ActivityIndicator size="small" color="#9333EA" className="mr-2" />
                            <Text className="text-purple-700 dark:text-purple-300 font-medium">
                                AI özeti hazırlıyor...
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
};
