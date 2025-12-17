import PocketBase, { AsyncAuthStore } from 'pocketbase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage wrapper for PocketBase
const store = new AsyncAuthStore({
  save: async (serialized) => {
    try {
      await AsyncStorage.setItem('pb_auth', serialized);
    } catch (e) {
      console.error('AsyncAuthStore SAVE ERROR:', e);
    }
  },
  clear: async () => {
    await AsyncStorage.removeItem('pb_auth');
  },
});

// PocketBase instance with AsyncAuthStore
export const pb = new PocketBase(
  'https://book.api.cinevault.space',
  store,
);

// Export types for convenience
export type User = {
  id: string;
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  role?: string;
  created: string;
  updated: string;
};

export default pb;
