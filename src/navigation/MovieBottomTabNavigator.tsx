import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MovieLibraryScreen } from '../screens/movies/MovieLibraryScreen';
import { MovieSearchScreen } from '../screens/movies/MovieSearchScreen';
import { MovieSettingsScreen } from '../screens/movies/MovieSettingsScreen';

export type RootTabParamList = {
    MovieLibrary: undefined;
    MovieSearch: undefined;
    MovieSettings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

import { useColorScheme } from 'nativewind';

export const MovieBottomTabNavigator = () => {
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
                name="MovieLibrary"
                component={MovieLibraryScreen}
                options={{
                    tabBarLabel: t('tabs.library', 'Library'),
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="movie-open-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="MovieSearch"
                component={MovieSearchScreen}
                options={{
                    tabBarLabel: t('tabs.search', 'Search'),
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="magnify" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="MovieSettings"
                component={MovieSettingsScreen}
                options={{
                    tabBarLabel: t('tabs.settings', 'Settings'),
                    tabBarIcon: ({ color, size }) => (
                        <Icon name="cog-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};
