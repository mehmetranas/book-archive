import type { Book } from '../../screens/LibraryScreen';
import { serviceClient } from './client';

export interface BookNote {
    id: string;
    book: string;
    cleaned_text?: string;
    summary?: string;
    tags?: string[];
    sentiment?: string;
    created: string;
    updated: string;
}

export interface BookStatus {
    id: string;
    updated: string;
    enrichment_status: Book['enrichment_status'];
    image_gen_status: Book['image_gen_status'];
}

export interface BookStats {
    totalBooks: number;
    totalPages: number;
    avgPages: number;
}

export interface BookList {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
    items: Book[];
}

export interface ListBooksParams {
    status?: string;
    in_library?: boolean;
    is_archived?: boolean;
    search?: string;
    page?: number;
    perPage?: number;
}

export interface CreateBookBody {
    title: string;
    authors?: string[];
    cover_url?: string;
    isbn?: string;
    google_books_id?: string;
    page_count?: number;
    description?: string;
    status?: string;
    language_code?: string;
}

export const booksApi = {
    listBooks: async (params: ListBooksParams = {}): Promise<BookList> => {
        const { data } = await serviceClient.get<BookList>('/books', { params });
        return data;
    },

    getBook: async (id: string): Promise<Book> => {
        const { data } = await serviceClient.get<Book>(`/books/${id}`);
        return data;
    },

    getBookStatus: async (id: string): Promise<BookStatus> => {
        const { data } = await serviceClient.get<BookStatus>(`/books/${id}/status`);
        return data;
    },

    getBookNotes: async (id: string): Promise<BookNote[]> => {
        const { data } = await serviceClient.get<BookNote[]>(`/books/${id}/notes`);
        return data;
    },

    getBookStats: async (): Promise<BookStats> => {
        const { data } = await serviceClient.get<BookStats>('/books/stats');
        return data;
    },

    createBook: async (body: CreateBookBody): Promise<Book> => {
        const { data } = await serviceClient.post<Book>('/books', body);
        return data;
    },

    updateBook: async (id: string, body: Partial<Book>): Promise<Book> => {
        const { data } = await serviceClient.patch<Book>(`/books/${id}`, body);
        return data;
    },

    deleteBook: async (id: string): Promise<void> => {
        await serviceClient.delete(`/books/${id}`);
    },

    enrichBook: async (id: string): Promise<{ enrichment_status: string }> => {
        const { data } = await serviceClient.post(`/books/${id}/enrich`);
        return data;
    },
};
