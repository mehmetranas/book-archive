import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import './global.css';
import i18n from './src/config/i18n';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ModeProvider, useMode } from './src/context/ModeContext';
import { ConfigProvider } from './src/context/ConfigContext';

import { MainNavigator } from './src/navigation/MainNavigator';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { MovieNavigator } from './src/navigation/MovieNavigator';
import { RevenueCatService } from './src/services/revenuecat';

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
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const { mode } = useMode();

    if (isAuthLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    if (!isAuthenticated) {
        return <AuthNavigator />;
    }

    return mode === 'movies' ? <MovieNavigator /> : <MainNavigator />;
};

import Toast from 'react-native-toast-message';

function App(): React.JSX.Element {
    React.useEffect(() => {
        const loadLanguage = async () => {
            // ... existing code ...
            // Initialize RevenueCat
            await RevenueCatService.initialize();

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
                    <ConfigProvider>
                        <ModeProvider>
                            <NavigationContainer>
                                <AppNavigator />
                            </NavigationContainer>
                        </ModeProvider>
                    </ConfigProvider>
                </AuthProvider>
            </QueryClientProvider>
            <Toast />
        </SafeAreaProvider>
    );
}

export default App;
