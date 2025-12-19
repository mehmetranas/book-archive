import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';
import { useConfig } from '../context/ConfigContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pb } from '../services/pocketbase';

export const SettingsScreen = () => {
    const { t, i18n } = useTranslation();
    const { logout, user } = useAuth();
    const { toggleMode } = useMode();
    const { aiConfig } = useConfig();
    const insets = useSafeAreaInsets();

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
                {(user?.role === 'admin' || user?.role === 'tester' || user?.role === 'premium') && (
                    <TouchableOpacity
                        onPress={toggleMode}
                        className="bg-indigo-100 dark:bg-indigo-900 rounded-lg p-4 mb-6 flex-row items-center border border-indigo-200 dark:border-indigo-800"
                    >
                        <View className="bg-indigo-200 dark:bg-indigo-800 p-2 rounded-full mr-4">
                            <Icon name="movie-open" size={24} color="#4338CA" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                                CineVault'a Geç
                            </Text>
                            <Text className="text-indigo-700 dark:text-indigo-300 text-sm">
                                Film arşivinizi yönetmek için tıklayın
                            </Text>
                        </View>
                        <Icon name="chevron-right" size={24} color="#4338CA" />
                    </TouchableOpacity>
                )}

                {/* User Info */}
                {user && (
                    <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {user.name || user.username || 'User'}
                        </Text>
                        <Text className="text-gray-600 dark:text-gray-400 mb-4">
                            {user.email}
                        </Text>

                        {/* Credits Section */}
                        <View className="border-t border-gray-200 dark:border-gray-700 pt-4 flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <Icon name="bitcoin" size={24} color="#9333EA" className="mr-2" />
                                <View>
                                    <Text className="text-gray-900 dark:text-white font-bold text-lg">
                                        {user.credits ?? 0} Kredi
                                    </Text>
                                    <Text className="text-gray-500 text-xs">AI özellikleri için kullanılır</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={handleBuyCredits}
                                className="bg-purple-100 dark:bg-purple-900 px-4 py-2 rounded-full"
                            >
                                <Text className="text-purple-700 dark:text-purple-300 font-bold">Yükle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Automation Settings */}
                {user && (
                    <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Otomasyon
                        </Text>
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 pr-4">
                                <Text className="text-base text-gray-900 dark:text-white font-medium">Otomatik Analiz</Text>
                                <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Yeni kitap eklendiğinde otomatik olarak analiz (özet, öneriler vb.) başlat.
                                    {aiConfig.promo_text ? (
                                        <Text className="text-green-600 dark:text-green-400 font-bold"> {aiConfig.promo_text}</Text>
                                    ) : null}
                                </Text>
                            </View>
                            <Switch
                                value={user.settings?.auto_ai_enrichment || false}
                                onValueChange={async (val) => {
                                    if (!user.id) return;
                                    try {
                                        const newSettings = { ...(user.settings || {}), auto_ai_enrichment: val };
                                        const updated = await pb.collection('users').update(user.id, { settings: newSettings });
                                        if (pb.authStore.model) {
                                            pb.authStore.save(pb.authStore.token, updated);
                                        }
                                    } catch (e) {
                                        console.error(e);
                                        Alert.alert("Hata", "Ayar kaydedilemedi.");
                                    }
                                }}
                                trackColor={{ false: "#767577", true: "#9333EA" }}
                                thumbColor={user.settings?.auto_ai_enrichment ? "#ffffff" : "#f4f3f4"}
                            />
                        </View>
                    </View>
                )}

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
