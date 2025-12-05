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

export const MovieBottomTabNavigator = () => {
    const { t } = useTranslation();

    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: '#3B82F6',
                tabBarInactiveTintColor: '#9CA3AF',
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopColor: '#E5E7EB',
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
