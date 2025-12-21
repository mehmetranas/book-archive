import React, { useMemo } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pb } from '../services/pocketbase';

export const ProfileScreen = () => {
    const { t } = useTranslation();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const user = pb.authStore.record;

    // Fetch finished books for statistics
    const { data: finishedBooks, refetch, isLoading: isStatsLoading } = useQuery({
        queryKey: ['books', 'read_stats'],
        queryFn: async () => {
            return await pb.collection('books').getFullList({
                filter: `user = "${user?.id}" && status = "read"`,
                sort: '-updated'
            });
        }
    });

    // Statistics Calculations
    const stats = useMemo(() => {
        const books = finishedBooks || [];
        const totalBooks = books.length;
        const totalPages = books.reduce((sum, book) => sum + (book.page_count || 0), 0);
        const avgPages = totalBooks > 0 ? Math.round(totalPages / totalBooks) : 0;

        return { totalBooks, totalPages, avgPages };
    }, [finishedBooks]);

    // Reading Challenge Goal (Hardcoded for now, later user setting)
    const yearlyGoal = 20;
    const progressPercent = Math.min((stats.totalBooks / yearlyGoal) * 100, 100);

    const handleRefresh = async () => {
        await refetch();
    };

    return (
        <View className="flex-1 bg-gray-50 dark:bg-gray-900" style={{ paddingTop: insets.top }}>
            {/* Header / User Info */}
            <View className="px-6 py-4 bg-white dark:bg-gray-800 shadow-sm z-10">
                <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-1" />

                    <TouchableOpacity
                        onPress={handleRefresh}
                        className={`p-2 rounded-full ${isStatsLoading ? 'bg-gray-100 dark:bg-gray-700' : 'bg-blue-50 dark:bg-blue-900/20'}`}
                        disabled={isStatsLoading}
                    >
                        <Icon
                            name="refresh"
                            size={20}
                            color={isStatsLoading ? "#9CA3AF" : "#3B82F6"}
                            style={isStatsLoading ? { opacity: 0.5 } : {}}
                        />
                    </TouchableOpacity>
                </View>

                <View className="items-center -mt-8">
                    <View className="w-24 h-24 bg-blue-100 dark:bg-gray-700 rounded-full items-center justify-center mb-3 shadow-inner border-4 border-white dark:border-gray-800">
                        {user?.avatar ? (
                            <Image
                                source={{ uri: pb.files.getUrl(user, user.avatar) }}
                                className="w-full h-full rounded-full"
                            />
                        ) : (
                            <Text className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </Text>
                        )}
                    </View>
                    <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {user?.name || user?.username || t('profile.user', 'Kullanıcı')}
                    </Text>

                    {/* Credits & Store Button */}
                    <View className="flex-row items-center mt-2 mb-2 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-full border border-indigo-100 dark:border-indigo-800">
                        <Icon name="diamond-stone" size={16} color="#6366F1" className="mr-2" />
                        <Text className="text-indigo-700 dark:text-indigo-300 font-bold mr-3">
                            {user?.credits || 0} {t('common.credit', 'Kredi')}
                        </Text>
                        <TouchableOpacity
                            onPress={() => (navigation as any).navigate('Store')}
                            className="bg-indigo-600 px-3 py-1 rounded-full items-center justify-center"
                        >
                            <Text className="text-white text-xs font-bold">
                                + {t('store.add', 'Yükle')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                        {t('profile.memberSince', 'Üyelik: 2024')}
                    </Text>
                </View>
            </View>

            <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>

                {/* 1. Yearly Challenge Section */}
                <View className="mb-6 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">
                            {t('profile.readingChallenge', '2024 Okuma Hedefi')}
                        </Text>
                        <View className="bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                            <Text className="text-blue-600 dark:text-blue-400 text-xs font-bold">
                                {progressPercent.toFixed(0)}%
                            </Text>
                        </View>
                    </View>

                    {/* Progress Bar */}
                    <View className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full mb-3 overflow-hidden">
                        <View
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </View>
                    <Text className="text-gray-600 dark:text-gray-300 text-sm text-center font-medium">
                        <Text className="text-blue-600 dark:text-blue-400 font-bold">{stats.totalBooks}</Text> / {yearlyGoal} Kitap Tamamlandı
                    </Text>
                    <Text className="text-gray-400 dark:text-gray-500 text-xs text-center mt-2">
                        {stats.totalBooks >= yearlyGoal
                            ? t('profile.challengeCompleted', "Harikasın! Hedefini tamamladın! 🎉")
                            : t('profile.challengeRemaining', `{{count}} kitap daha okumalısın.`, { count: yearlyGoal - stats.totalBooks })}
                    </Text>
                </View>

                {/* 2. Key Statistics Grid */}
                <View className="flex-row justify-between mb-6">
                    {/* Stat Card 1: Books */}
                    <View className="flex-1 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mr-3 items-center">
                        <View className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full items-center justify-center mb-2">
                            <Icon name="book-open-page-variant" size={20} color="#F97316" />
                        </View>
                        <Text className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalBooks}</Text>
                        <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">{t('profile.booksRead', 'Okunan Kitap')}</Text>
                    </View>

                    {/* Stat Card 2: Pages */}
                    <View className="flex-1 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mr-3 items-center">
                        <View className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full items-center justify-center mb-2">
                            <Icon name="text-box-multiple-outline" size={20} color="#22C55E" />
                        </View>
                        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                            {stats.totalPages > 1000 ? `${(stats.totalPages / 1000).toFixed(1)}k` : stats.totalPages}
                        </Text>
                        <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">{t('profile.totalPages', 'Toplam Sayfa')}</Text>
                    </View>

                    {/* Stat Card 3: Average Page Count */}
                    <View className="flex-1 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 items-center">
                        <View className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full items-center justify-center mb-2">
                            <Icon name="chart-timeline-variant" size={20} color="#A855F7" />
                        </View>
                        <Text className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgPages}</Text>
                        <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">{t('profile.avgPages', 'Ort. Sayfa')}</Text>
                    </View>
                </View>

                {/* 3. Badges Preview (Static for now) */}
                <View className="mb-6">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">{t('profile.achievements', 'Başarımlar')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        {/* Earned Badge */}
                        <View className="items-center mr-5 opacity-100">
                            <View className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full items-center justify-center mb-2 border-2 border-yellow-400">
                                <Icon name="trophy" size={32} color="#EAB308" />
                            </View>
                            <Text className="text-xs font-bold text-gray-700 dark:text-gray-300">İlk Adım</Text>
                        </View>

                        {/* Locked Badge 1 */}
                        <View className="items-center mr-5 opacity-50">
                            <View className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-2 border-2 border-gray-300 dark:border-gray-600">
                                <Icon name="book-clock" size={32} color="#9CA3AF" />
                            </View>
                            <Text className="text-xs font-medium text-gray-500">Maratoncu</Text>
                        </View>

                        {/* Locked Badge 2 */}
                        <View className="items-center mr-5 opacity-50">
                            <View className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-2 border-2 border-gray-300 dark:border-gray-600">
                                <Icon name="earth" size={32} color="#9CA3AF" />
                            </View>
                            <Text className="text-xs font-medium text-gray-500">Kaşif</Text>
                        </View>

                        {/* Locked Badge 3 */}
                        <View className="items-center mr-5 opacity-50">
                            <View className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-2 border-2 border-gray-300 dark:border-gray-600">
                                <Icon name="fountain-pen-tip" size={32} color="#9CA3AF" />
                            </View>
                            <Text className="text-xs font-medium text-gray-500">Eleştirmen</Text>
                        </View>
                    </ScrollView>
                </View>

            </ScrollView>
        </View>
    );
};
