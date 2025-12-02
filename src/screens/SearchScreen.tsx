import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

export const SearchScreen = () => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = React.useState('');

    return (
        <View className="flex-1 bg-white dark:bg-gray-900 p-4">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {t('search.title')}
            </Text>
            <TextInput
                className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-3 mb-4"
                placeholder={t('search.placeholder')}
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
                <View className="flex-1 items-center justify-center">
                    <Text className="text-gray-600 dark:text-gray-400">
                        {t('search.noResults')}
                    </Text>
                </View>
            )}
        </View>
    );
};
