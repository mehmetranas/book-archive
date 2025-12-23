import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { pb } from './pocketbase';

// API KEYS (Placeholder - Replace with your actual RevenueCat Public API Keys)
// API KEYS
const API_KEYS = {
    ios: {
        debug: "test_rcIvnkhbcSEPjugCYCgmAPlJgQE", // Development / Sandbox Key
        release: "sk_LbRjJNOEcTiCwumUxoOOVpxYgponc" // Production / App Store Key
    },
    android: {
        debug: "test_rcIvnkhbcSEPjugCYCgmAPlJgQE",
        release: "sk_LbRjJNOEcTiCwumUxoOOVpxYgponc"
    }
};

export const RevenueCatService = {
    initialize: async () => {
        try {
            let apiKey = "";

            if (Platform.OS === 'ios') {
                apiKey = __DEV__ ? API_KEYS.ios.debug : API_KEYS.ios.release;
            } else if (Platform.OS === 'android') {
                apiKey = __DEV__ ? API_KEYS.android.debug : API_KEYS.android.release;
            }

            if (apiKey) {
                Purchases.configure({ apiKey });
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
