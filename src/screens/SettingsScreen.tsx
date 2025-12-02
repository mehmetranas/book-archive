import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const SettingsScreen = () => {
    const { t, i18n } = useTranslation();
    const { logout, user } = useAuth();
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
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {t('settings.language')}
                    </Text>
                    <Text className="text-gray-600 dark:text-gray-400">
                        Current: {i18n.language.toUpperCase()}
                    </Text>
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
