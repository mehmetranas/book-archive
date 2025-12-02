import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export const LibraryScreen = () => {
    const { t } = useTranslation();

    return (
        <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t('library.title')}
            </Text>
            <Text className="text-gray-600 dark:text-gray-400">
                {t('library.empty')}
            </Text>
            <Text className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                {t('library.emptyDescription')}
            </Text>
        </View>
    );
};
