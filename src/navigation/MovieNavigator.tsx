import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MovieBottomTabNavigator } from './MovieBottomTabNavigator';
import { MovieDetailScreen } from '../screens/movies/MovieDetailScreen';
import { DiscoveryListScreen } from '../screens/movies/DiscoveryListScreen';

export type MovieStackParamList = {
    MovieTabs: undefined;
    MovieDetail: { movieId?: string; tmdbId?: number; mediaType?: 'movie' | 'tv' };
    DiscoveryList: { id: number; name: string; role: 'director' | 'actor' | 'genre' };
};

const Stack = createNativeStackNavigator<MovieStackParamList>();

export const MovieNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MovieTabs" component={MovieBottomTabNavigator} />
            <Stack.Screen name="MovieDetail" component={MovieDetailScreen} />
            <Stack.Screen name="DiscoveryList" component={DiscoveryListScreen} />
        </Stack.Navigator>
    );
};
