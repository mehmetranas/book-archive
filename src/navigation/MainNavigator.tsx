import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabNavigator } from './BottomTabNavigator';
import { BookDetailScreen } from '../screens/BookDetailScreen';

import { ProfileScreen } from '../screens/ProfileScreen';
import { BarcodeScannerScreen } from '../screens/BarcodeScannerScreen';

export type MainStackParamList = {
    MainTabs: undefined;
    BookDetail: { bookId: string };
    BarcodeScanner: undefined;
    Profile: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export const MainNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen name="BookDetail" component={BookDetailScreen} />
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
        </Stack.Navigator>
    );
};
