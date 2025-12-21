import React from 'react';
import { View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useNavigation } from '@react-navigation/native';

export const StoreScreen = () => {
    const navigation = useNavigation();

    return (
        <View style={{ flex: 1 }}>
            <RevenueCatUI.Paywall
                onPurchaseCompleted={({ customerInfo }) => {
                    console.log("Purchase completed:", customerInfo);
                }}
                onDismiss={() => {
                    navigation.goBack();
                }}
            />
        </View>
    );
};
