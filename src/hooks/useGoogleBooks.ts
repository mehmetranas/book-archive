import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useDebounce } from './useDebounce';

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

interface GoogleBooksResponse {
    items?: GoogleBookItem[];
    totalItems: number;
}

export const useGoogleBooks = (query: string) => {
    const { i18n } = useTranslation();
    const debouncedQuery = useDebounce(query, 500);

    return useQuery({
        queryKey: ['googleBooks', debouncedQuery, i18n.language],
        queryFn: async () => {
            if (!debouncedQuery) return [];

            console.log('Google Books API Request:', `https://www.googleapis.com/books/v1/volumes?q=${debouncedQuery}&maxResults=20&printType=books`);

            const response = await axios.get<GoogleBooksResponse>(
                'https://www.googleapis.com/books/v1/volumes',
                {
                    params: {
                        q: debouncedQuery,
                        maxResults: 20,
                        printType: 'books',
                    },
                }
            );

            return response.data.items || [];
        },
        enabled: debouncedQuery.length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};
