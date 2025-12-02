import React, { useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { pb } from '../services/pocketbase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
}

export const LibraryScreen = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();

    const { data: books, isLoading, error, refetch } = useQuery({
        queryKey: ['books'],
        queryFn: async () => {
            return await pb.collection('books').getFullList<Book>({
                sort: '-created',
            });
        },
    });

    useEffect(() => {
        const unsubscribe = pb.collection('books').subscribe('*', (e) => {
            // Realtime update: Invalidate queries on any change
            // This specifically covers the case where enrichment_status changes from 'pending' to 'completed'
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
        const isProcessing = item.enrichment_status === 'processing';
        const hasAiNotes = item.ai_notes && item.ai_notes.trim().length > 0;

        // Ensure HTTPS for cover URL
        const coverUrl = item.cover_url?.startsWith('http://')
            ? item.cover_url.replace('http://', 'https://')
            : item.cover_url;

        return (
            <TouchableOpacity
                onPress={() => navigation.navigate('BookDetail', { bookId: item.id })}
                className="flex-row bg-white dark:bg-gray-800 p-3 mb-2 mx-4 rounded-xl shadow-sm items-center"
            >
                {/* Left: Small Cover Image (40x60 approx) */}
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
                <View className="flex-1 justify-center">
                    <View className="flex-row items-center mb-0.5">
                        <Text className="text-base font-bold text-gray-900 dark:text-white flex-shrink" numberOfLines={1}>
                            {item.title}
                        </Text>
                        {/* AI Warning Icon */}
                        {hasAiNotes && (
                            <View className="ml-2">
                                <Icon name="alert" size={18} color="#F97316" />
                            </View>
                        )}
                    </View>

                    <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1" numberOfLines={1}>
                        {Array.isArray(item.authors) ? item.authors.join(', ') : item.authors}
                    </Text>

                    {/* Status Badge */}
                    <View className="flex-row items-center">
                        <View className={`px-2 py-0.5 rounded-md self-start ${getStatusColor(item.status)}`}>
                            <Text className="text-xs font-medium">
                                {getStatusLabel(item.status)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Far Right: AI Processing Indicator */}
                {isProcessing && (
                    <View className="ml-2 flex-row items-center bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full border border-purple-100 dark:border-purple-800">
                        <ActivityIndicator size="small" color="#9333EA" className="mr-1.5" />
                        <Text className="text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                            AI Analyzing...
                        </Text>
                    </View>
                )}
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
                <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t('library.title', 'Library')}
                </Text>
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
                    data={books || []}
                    renderItem={renderItem}
                    estimatedItemSize={88}
                    contentContainerStyle={{ paddingTop: 16, paddingBottom: 20 }}
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
        </View>
    );
};
