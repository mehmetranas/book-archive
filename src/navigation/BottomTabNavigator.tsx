import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/Ionicons';
import { LibraryScreen } from '../screens/LibraryScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

export type RootTabParamList = {
    Library: undefined;
    Search: undefined;
    Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

import { useColorScheme } from 'nativewind';

// ...

export const BottomTabNavigator = () => {
    const { t } = useTranslation();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: '#3B82F6',
                tabBarInactiveTintColor: isDark ? '#9CA3AF' : '#9CA3AF',
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    borderTopColor: isDark ? '#374151' : '#E5E7EB',
                },
            }}>
            <Tab.Screen
                name="Library"
                component={LibraryScreen}
                options={{
                    tabBarLabel: t('tabs.library'),
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="library-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Search"
                component={SearchScreen}
                options={{
                    tabBarLabel: t('tabs.search'),
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="search-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                    tabBarLabel: t('tabs.settings'),
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="settings-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};
