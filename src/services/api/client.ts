import axios from 'axios';
import { pb } from '../pocketbase';

export const serviceClient = axios.create({
    baseURL: 'https://book.svc.cinevault.space',
});

serviceClient.interceptors.request.use((config) => {
    if (pb.authStore.token) {
        config.headers.Authorization = `Bearer ${pb.authStore.token}`;
    }
    return config;
});
