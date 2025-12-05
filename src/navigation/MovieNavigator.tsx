import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MovieBottomTabNavigator } from './MovieBottomTabNavigator';
import { MovieDetailScreen } from '../screens/movies/MovieDetailScreen';

export type MovieStackParamList = {
    MovieTabs: undefined;
    MovieDetail: { movieId: string };
};

const Stack = createNativeStackNavigator<MovieStackParamList>();

export const MovieNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MovieTabs" component={MovieBottomTabNavigator} />
            <Stack.Screen name="MovieDetail" component={MovieDetailScreen} />
        </Stack.Navigator>
    );
};
