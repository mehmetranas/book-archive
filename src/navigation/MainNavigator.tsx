import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabNavigator } from './BottomTabNavigator';
import { BookDetailScreen } from '../screens/BookDetailScreen';

export type MainStackParamList = {
    MainTabs: undefined;
    BookDetail: { bookId: string };
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export const MainNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen name="BookDetail" component={BookDetailScreen} />
        </Stack.Navigator>
    );
};
