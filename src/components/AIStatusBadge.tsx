import React from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';

interface AIStatusBadgeProps {
    status: string;
    size?: number;
    showLabel?: boolean;
}

export const AIStatusBadge: React.FC<AIStatusBadgeProps> = ({ status, size = 20, showLabel = false }) => {
    const { t } = useTranslation();

    if (!status || status === 'none') return null;

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'pending':
                return {
                    icon: 'clock-outline',
                    color: 'text-gray-400',
                    iconColor: '#9CA3AF',
                    label: t('aiStatus.pending', 'Pending')
                };
            case 'processing':
                return {
                    icon: 'progress-clock',
                    color: 'text-blue-400',
                    iconColor: '#60A5FA',
                    label: t('aiStatus.processing', 'Processing')
                };
            case 'completed':
                return {
                    icon: 'creation',
                    color: 'text-purple-400',
                    iconColor: '#C084FC',
                    label: t('aiStatus.completed', 'Completed')
                };
            case 'failed':
                return {
                    icon: 'alert-circle-outline',
                    color: 'text-red-400',
                    iconColor: '#F87171',
                    label: t('aiStatus.failed', 'Failed')
                };
            default:
                return {
                    icon: 'help-circle-outline',
                    color: 'text-gray-400',
                    iconColor: '#9CA3AF',
                    label: status
                };
        }
    };

    const config = getStatusConfig(status);

    return (
        <View className="flex-row items-center">
            <Icon name={config.icon} size={size} color={config.iconColor} />
            {showLabel && (
                <Text className={`ml-1 text-xs font-medium ${config.color}`}>
                    {config.label}
                </Text>
            )}
        </View>
    );
};
