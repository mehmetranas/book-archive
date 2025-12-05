import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Character } from '../screens/LibraryScreen';

interface CharacterCardProps {
    character: Character;
}

export const CharacterCard = ({ character }: CharacterCardProps) => {
    const { t } = useTranslation();

    return (
        <View className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mr-3 w-64 border border-gray-100 dark:border-gray-700">
            <View className="mb-2">
                <Text className="text-lg font-bold text-gray-900 dark:text-white" numberOfLines={1}>
                    {character.name}
                </Text>
                <Text className="text-sm font-medium text-blue-600 dark:text-blue-400" numberOfLines={1}>
                    {character.role}
                </Text>
            </View>

            {/* Traits */}
            <View className="flex-row flex-wrap gap-1 mb-2">
                {character.traits.slice(0, 3).map((trait, index) => (
                    <View key={index} className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">
                        <Text className="text-xs text-gray-600 dark:text-gray-300">
                            {trait}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Relationships - Condensed */}
            {character.relationships && character.relationships.length > 0 && (
                <View className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
                    <Text className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">{t('character.relations', 'İlişkiler')}:</Text>
                    {character.relationships.slice(0, 2).map((rel, idx) => (
                        <Text key={idx} className="text-xs text-gray-400 dark:text-gray-500 italic" numberOfLines={1}>
                            • {rel.type} → {rel.target}
                        </Text>
                    ))}
                </View>
            )}
        </View>
    );
};
