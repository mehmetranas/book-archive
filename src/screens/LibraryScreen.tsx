import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pb } from '../services/pocketbase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AIStatusBadge } from '../components/AIStatusBadge';

export interface Relationship {
    target: string;
    type: string;
    details?: string;
}

export interface Character {
    name: string;
    role: string;
    traits: string[];
    relationships?: Relationship[];
}

export interface Book {
    id: string;
    collectionId: string;
    collectionName: string;
    created: string;
    updated: string;
    title: string;
    authors: string[];
    cover_url: string;
    status: string;
    enrichment_status: 'pending' | 'processing' | 'completed' | 'failed';
    google_books_id: string;
    description?: string;
    ai_notes?: string;
    isbn?: string;
    in_library?: boolean;
    is_archived?: boolean;
    character_analysis_status?: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
    character_map?: Character[];
    image_gen_status?: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
    generated_image_base64?: string;
    generated_image?: string;
    expand?: any;
}

export const LibraryScreen = () => {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [manualTitle, setManualTitle] = useState('');
    const [manualAuthor, setManualAuthor] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: books, isLoading, error, refetch } = useQuery({
        queryKey: ['books'],
        queryFn: async () => {
            return await pb.collection('books').getFullList<Book>({
                sort: '-created',
            });
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

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await pb.collection('books').delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['books'] });
        },
        onError: (err) => {
            Alert.alert(t('common.error'), t('common.deleteError', 'Silme işlemi başarısız oldu.'));
        }
    });

    const handleDelete = (id: string, title: string) => {
        Alert.alert(
            t('common.delete', 'Sil'),
            t('common.deleteConfirmation', '"{title}" kitabını silmek istediğinize emin misiniz?', { title }),
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
        const unsubscribe = pb.collection('books').subscribe('*', (e) => {
            if (e.action === 'create' || e.action === 'delete' || e.action === 'update') {
                queryClient.invalidateQueries({ queryKey: ['books'] });
            }
        });

        return () => {
            unsubscribe.then((unsub) => unsub());
        };
    }, [queryClient]);

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'want_to_read': return t('status.wantToRead', 'Okunacak');
            case 'reading': return t('status.reading', 'Okunuyor');
            case 'read': return t('status.read', 'Tamamlandı');
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'want_to_read': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'reading': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'read': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const renderItem = ({ item }: { item: Book }) => {
        // Ensure HTTPS for cover URL
        const coverUrl = item.cover_url?.startsWith('http://')
            ? item.cover_url.replace('http://', 'https://')
            : item.cover_url;

        return (
            <TouchableOpacity
                onPress={() => navigation.navigate('BookDetail', { bookId: item.id })}
                className="flex-row bg-white dark:bg-gray-800 p-3 mb-2 mx-4 rounded-xl shadow-sm items-center"
            >
                {/* Left: Small Cover Image */}
                <View className="w-10 h-16 mr-3 shadow-sm bg-gray-200 dark:bg-gray-700 rounded-sm overflow-hidden">
                    {coverUrl ? (
                        <Image
                            source={{ uri: coverUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center">
                            <Icon name="book-open-variant" size={20} color="#9CA3AF" />
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
                        {Array.isArray(item.authors) ? item.authors.join(', ') : item.authors}
                    </Text>

                    {/* Status & Icons Row */}
                    <View className="flex-row items-center mt-1 flex-wrap gap-2">
                        {/* Status Badge */}
                        <View className={`px-2 py-0.5 rounded-md ${getStatusColor(item.status)}`}>
                            <Text className="text-xs font-medium">
                                {getStatusLabel(item.status)}
                            </Text>
                        </View>

                        {/* AI Badge */}
                        <AIStatusBadge status={item.enrichment_status} size={16} />

                        {/* Library Badge */}
                        {item.in_library && (
                            <View className="bg-green-100 dark:bg-green-900 px-1.5 py-0.5 rounded">
                                <Icon name="bookshelf" size={12} color="#166534" />
                            </View>
                        )}

                        {/* Archive Badge */}
                        {item.is_archived && (
                            <View className="bg-orange-100 dark:bg-orange-900 px-1.5 py-0.5 rounded">
                                <Icon name="archive" size={12} color="#C2410C" />
                            </View>
                        )}

                        {/* Character Analysis Badge */}
                        {item.character_analysis_status === 'completed' && (
                            <View className="bg-indigo-100 dark:bg-indigo-900 px-1.5 py-0.5 rounded">
                                <Icon name="head-snowflake-outline" size={12} color="#4F46E5" />
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
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
                    {t('library.title', 'Library')}
                </Text>
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                    <Icon name="magnify" size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-2 text-gray-900 dark:text-white"
                        placeholder={t('library.searchPlaceholder', 'Kitap veya yazar ara...')}
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
                        {t('common.error', 'An error occurred')}
                    </Text>
                    <TouchableOpacity onPress={() => refetch()} className="mt-4 bg-blue-600 px-4 py-2 rounded-lg">
                        <Text className="text-white font-semibold">{t('common.retry', 'Retry')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlashList<Book>
                    data={books?.filter(book => {
                        const query = searchQuery.toLowerCase();
                        const authors = Array.isArray(book.authors) ? book.authors.join(' ') : (book.authors || '');
                        return (
                            book.title.toLowerCase().includes(query) ||
                            authors.toLowerCase().includes(query)
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
                            <Icon name="bookshelf" size={64} color="#D1D5DB" />
                            <Text className="text-gray-500 dark:text-gray-400 text-center mt-4 text-lg">
                                {t('library.empty', 'Your library is empty')}
                            </Text>
                            <Text className="text-gray-400 dark:text-gray-500 text-center mt-2 text-sm">
                                {t('library.emptyDescription', 'Add books to get started')}
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
