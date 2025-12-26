import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MovieBottomTabNavigator } from './MovieBottomTabNavigator';
import { MovieDetailScreen } from '../screens/movies/MovieDetailScreen';
import { PersonMoviesScreen } from '../screens/movies/PersonMoviesScreen';

export type MovieStackParamList = {
    MovieTabs: undefined;
    MovieDetail: { movieId?: string; tmdbId?: number; mediaType?: 'movie' | 'tv' };
    PersonMovies: { personId: number; personName: string; role: 'director' | 'actor' };
};

const Stack = createNativeStackNavigator<MovieStackParamList>();

export const MovieNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MovieTabs" component={MovieBottomTabNavigator} />
            <Stack.Screen name="MovieDetail" component={MovieDetailScreen} />
            <Stack.Screen name="PersonMovies" component={PersonMoviesScreen} />
        </Stack.Navigator>
    );
};
