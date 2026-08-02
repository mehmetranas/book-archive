import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useDebounce } from './useDebounce';
import { serviceClient } from '../services/api/client';

export interface GoogleBookVolumeInfo {
    title: string;
    authors?: string[];
    imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
    };
    description?: string;
    publishedDate?: string;
    industryIdentifiers?: Array<{
        type: string;
        identifier: string;
    }>;
    pageCount?: number;
}

export interface GoogleBookItem {
    id: string;
    volumeInfo: GoogleBookVolumeInfo;
}

export const useGoogleBooks = (query: string) => {
    const { i18n } = useTranslation();
    const debouncedQuery = useDebounce(query, 500);

    return useQuery({
        queryKey: ['googleBooks', debouncedQuery, i18n.language],
        queryFn: async () => {
            if (!debouncedQuery) return [];

            const { data } = await serviceClient.get<GoogleBookItem[]>('/book-search', {
                params: { q: debouncedQuery },
            });

            return data || [];
        },
        enabled: debouncedQuery.length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};
