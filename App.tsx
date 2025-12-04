import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import './global.css';
import i18n from './src/config/i18n';
import { AuthProvider, useAuth } from './src/context/AuthContext';

import { MainNavigator } from './src/navigation/MainNavigator';
import { AuthNavigator } from './src/navigation/AuthNavigator';

// TanStack Query client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            staleTime: 5 * 60 * 1000, // 5 minutes
        },
    },
});

// App Navigator - handles auth state routing
const AppNavigator = () => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    return isAuthenticated ? <MainNavigator /> : <AuthNavigator />;
};

function App(): React.JSX.Element {
    React.useEffect(() => {
        const loadLanguage = async () => {
            try {
                const storedLang = await AsyncStorage.getItem('user-language');
                if (storedLang) {
                    i18n.changeLanguage(storedLang);
                }
            } catch (e) {
                console.error('Failed to load language', e);
            }
        };
        loadLanguage();
    }, []);

    return (
        <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <NavigationContainer>
                        <AppNavigator />
                    </NavigationContainer>
                </AuthProvider>
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}

export default App;
