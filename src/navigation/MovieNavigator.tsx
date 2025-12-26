import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MovieBottomTabNavigator } from './MovieBottomTabNavigator';
import { MovieDetailScreen } from '../screens/movies/MovieDetailScreen';
import { DirectorMoviesScreen } from '../screens/movies/DirectorMoviesScreen';

export type MovieStackParamList = {
    MovieTabs: undefined;
    MovieDetail: { movieId?: string; tmdbId?: number; mediaType?: 'movie' | 'tv' };
    DirectorMovies: { directorId: number; directorName: string };
};

const Stack = createNativeStackNavigator<MovieStackParamList>();

export const MovieNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MovieTabs" component={MovieBottomTabNavigator} />
            <Stack.Screen name="MovieDetail" component={MovieDetailScreen} />
            <Stack.Screen name="DirectorMovies" component={DirectorMoviesScreen} />
        </Stack.Navigator>
    );
};
