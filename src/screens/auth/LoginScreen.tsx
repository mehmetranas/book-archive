import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

type LoginScreenProps = {
    onNavigateToRegister: () => void;
};

export const LoginScreen = ({ onNavigateToRegister }: LoginScreenProps) => {
    const { t } = useTranslation();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleLogin = async () => {
        setError('');

        // Validation
        if (!email.trim()) {
            setError(t('auth.errors.emailRequired'));
            return;
        }

        if (!validateEmail(email)) {
            setError(t('auth.errors.invalidEmail'));
            return;
        }

        if (!password) {
            setError(t('auth.errors.passwordRequired'));
            return;
        }

        setIsLoading(true);

        try {
            await login(email.trim(), password);
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || t('auth.errors.loginFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white dark:bg-gray-900">
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled">
                <View className="flex-1 justify-center px-6 py-12">
                    {/* Header */}
                    <View className="mb-8">
                        <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                            {t('app.name')}
                        </Text>
                        <Text className="text-xl text-gray-600 dark:text-gray-400">
                            {t('auth.login')}
                        </Text>
                    </View>

                    {/* Error Message */}
                    {error ? (
                        <View className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <Text className="text-red-600 dark:text-red-400">{error}</Text>
                        </View>
                    ) : null}

                    {/* Email Input */}
                    <View className="mb-4">
                        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('auth.email')}
                        </Text>
                        <TextInput
                            className="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700"
                            placeholder={t('auth.email')}
                            placeholderTextColor="#9CA3AF"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            editable={!isLoading}
                        />
                    </View>

                    {/* Password Input */}
                    <View className="mb-6">
                        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('auth.password')}
                        </Text>
                        <TextInput
                            className="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700"
                            placeholder={t('auth.password')}
                            placeholderTextColor="#9CA3AF"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            editable={!isLoading}
                        />
                    </View>

                    {/* Login Button */}
                    <TouchableOpacity
                        className={`rounded-lg py-4 mb-4 ${isLoading ? 'bg-blue-400' : 'bg-blue-600'
                            }`}
                        onPress={handleLogin}
                        disabled={isLoading}>
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text className="text-white text-center font-semibold text-lg">
                                {t('auth.loginButton')}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Register Link */}
                    <View className="flex-row justify-center items-center">
                        <Text className="text-gray-600 dark:text-gray-400">
                            {t('auth.noAccount')}{' '}
                        </Text>
                        <TouchableOpacity onPress={onNavigateToRegister} disabled={isLoading}>
                            <Text className="text-blue-600 dark:text-blue-400 font-semibold">
                                {t('auth.registerHere')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};
