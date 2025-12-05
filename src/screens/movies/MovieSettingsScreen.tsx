import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useMode } from '../../context/ModeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const MovieSettingsScreen = () => {
    const { t, i18n } = useTranslation();
    const { logout, user } = useAuth();
    const { toggleMode } = useMode();
    const insets = useSafeAreaInsets();

    const handleLogout = () => {
        Alert.alert(
            t('settings.logout'),
            'Are you sure you want to logout?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: t('settings.logout'),
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                    },
                },
            ],
        );
    };

    return (
        <ScrollView
            className="flex-1 bg-white dark:bg-gray-900"
            style={{ paddingTop: insets.top }}
        >
            <View className="p-4">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    {t('settings.title')}
                </Text>

                {/* Switch App Mode */}
                <TouchableOpacity
                    onPress={toggleMode}
                    className="bg-purple-100 dark:bg-purple-900 rounded-lg p-4 mb-6 flex-row items-center border border-purple-200 dark:border-purple-800"
                >
                    <View className="bg-purple-200 dark:bg-purple-800 p-2 rounded-full mr-4">
                        <Icon name="book-open-variant" size={24} color="#6B21A8" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-lg font-bold text-purple-900 dark:text-purple-100">
                            Book Vault'a Geç
                        </Text>
                        <Text className="text-purple-700 dark:text-purple-300 text-sm">
                            Kitap arşivinizi yönetmek için tıklayın
                        </Text>
                    </View>
                    <Icon name="chevron-right" size={24} color="#6B21A8" />
                </TouchableOpacity>

                {/* User Info */}
                {user && (
                    <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {user.name || user.username || 'User'}
                        </Text>
                        <Text className="text-gray-600 dark:text-gray-400">
                            {user.email}
                        </Text>
                    </View>
                )}

                {/* Language */}
                <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        {t('settings.language')}
                    </Text>
                    <View className="flex-row space-x-3">
                        <TouchableOpacity
                            onPress={async () => {
                                await i18n.changeLanguage('en');
                                await AsyncStorage.setItem('user-language', 'en');
                            }}
                            className={`flex-1 py-2 rounded-lg border ${i18n.language === 'en'
                                ? 'bg-blue-600 border-blue-600'
                                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                }`}
                        >
                            <Text
                                className={`text-center font-medium ${i18n.language === 'en'
                                    ? 'text-white'
                                    : 'text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                English
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={async () => {
                                await i18n.changeLanguage('tr');
                                await AsyncStorage.setItem('user-language', 'tr');
                            }}
                            className={`flex-1 py-2 rounded-lg border ${i18n.language === 'tr'
                                ? 'bg-blue-600 border-blue-600'
                                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                }`}
                        >
                            <Text
                                className={`text-center font-medium ${i18n.language === 'tr'
                                    ? 'text-white'
                                    : 'text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                Türkçe
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Theme */}
                <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {t('settings.theme')}
                    </Text>
                    <Text className="text-gray-600 dark:text-gray-400">System</Text>
                </View>

                {/* About */}
                <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {t('settings.about')}
                    </Text>
                    <Text className="text-gray-600 dark:text-gray-400">
                        {t('app.name')} v1.0.0
                    </Text>
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                    className="bg-red-600 rounded-lg py-4 mt-4"
                    onPress={handleLogout}>
                    <Text className="text-white text-center font-semibold text-lg">
                        {t('settings.logout')}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};
