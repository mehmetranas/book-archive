import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { pb } from './pocketbase';

// API KEYS (Placeholder - Replace with your actual RevenueCat Public API Keys)
const API_KEYS = {
    ios: "test_rcIvnkhbcSEPjugCYCgmAPlJgQE", // Placeholder from documentation/screenshot
    android: "test_rcIvnkhbcSEPjugCYCgmAPlJgQE" // Placeholder from documentation/screenshot
};

export const RevenueCatService = {
    initialize: async () => {
        try {
            if (Platform.OS === 'ios') {
                Purchases.configure({ apiKey: API_KEYS.ios });
            } else if (Platform.OS === 'android') {
                Purchases.configure({ apiKey: API_KEYS.android });
            }

            // Enable debug logs for development
            Purchases.setLogLevel(LOG_LEVEL.DEBUG);

            // Check if user is already logged in to PocketBase, if so, identify them in RC
            if (pb.authStore.isValid && pb.authStore.model?.id) {
                await Purchases.logIn(pb.authStore.model.id);
            }

        } catch (e) {
            console.error('[RevenueCat] Init Error:', e);
        }
    },

    login: async (userId: string) => {
        try {
            const { customerInfo } = await Purchases.logIn(userId);
            console.log('[RevenueCat] Logged in as:', userId);
            return customerInfo;
        } catch (e) {
            console.error('[RevenueCat] Login Error:', e);
        }
    },

    logout: async () => {
        try {
            await Purchases.logOut();
            console.log('[RevenueCat] Logged out');
        } catch (e) {
            console.error('[RevenueCat] Logout Error:', e);
        }
    },

    getOfferings: async () => {
        try {
            const offerings = await Purchases.getOfferings();
            return offerings.current;
        } catch (e) {
            console.error('[RevenueCat] Error fetching offerings:', e);
            return null;
        }
    },

    purchasePackage: async (pkg: any) => {
        try {
            const { customerInfo } = await Purchases.purchasePackage(pkg);
            return customerInfo;
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error('[RevenueCat] Purchase Error:', e);
                throw e;
            }
        }
    }
};
