import axios from 'axios';
import { Platform } from 'react-native';
import { pb } from '../pocketbase';

// In dev, point at the locally-running backend/service (`npm run dev` there,
// listens on :3000) instead of production, so backend changes are visible
// without a git push + Coolify deploy round-trip. Android emulator can't
// reach the host machine via `localhost`, hence the 10.0.2.2 alias.
const DEV_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
const PROD_BASE_URL = 'https://book.svc.cinevault.space';

export const serviceClient = axios.create({
    baseURL: __DEV__ ? DEV_BASE_URL : PROD_BASE_URL,
});

serviceClient.interceptors.request.use((config) => {
    if (pb.authStore.token) {
        config.headers.Authorization = `Bearer ${pb.authStore.token}`;
    }
    return config;
});
