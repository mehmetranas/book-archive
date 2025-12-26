import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabNavigator } from './BottomTabNavigator';
import { BookDetailScreen } from '../screens/BookDetailScreen';

import { ProfileScreen } from '../screens/ProfileScreen';
import { BarcodeScannerScreen } from '../screens/BarcodeScannerScreen';
import { MovieDetailScreen } from '../screens/movies/MovieDetailScreen';
import { DiscoveryListScreen } from '../screens/movies/DiscoveryListScreen';
import { StoreScreen } from '../screens/StoreScreen';

export type MainStackParamList = {
    MainTabs: undefined;
    BookDetail: { bookId: string };
    MovieDetail: { movieId?: string; tmdbId?: number; mediaType?: 'movie' | 'tv' };
    DiscoveryList: { id: number | string; name: string; role: 'director' | 'actor' | 'genre' | 'year' };
    BarcodeScanner: undefined;
    Profile: undefined;
    Store: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export const MainNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen name="BookDetail" component={BookDetailScreen} />
            <Stack.Screen name="MovieDetail" component={MovieDetailScreen} />
            <Stack.Screen name="DiscoveryList" component={DiscoveryListScreen} />
            <Stack.Screen
                name="BarcodeScanner"
                component={BarcodeScannerScreen}
                options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
                name="Store"
                component={StoreScreen}
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
        </Stack.Navigator>
    );
};
