
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { SupabaseConfig, Book } from '../types';

// Supabase client is loaded from a CDN, so we declare it globally for TypeScript
declare global {
  interface Window {
    supabase: {
      createClient: (url: string, key: string) => SupabaseClient;
    };
  }
}

export const initializeSupabase = (config: SupabaseConfig): SupabaseClient => {
  if (!window.supabase) {
    throw new Error("Supabase client could not be found. Please check the script tag in your index.html.");
  }
  // Use the new nested config structure
  return window.supabase.createClient(config.supabase.url, config.supabase.anonKey);
};

export const getBooks = async (client: SupabaseClient, page: number, pageSize: number, searchTerm: string = ''): Promise<{ data: Book[] | null; error: PostgrestError | null }> => {
  if (searchTerm) {
    // Call the custom SQL function for searching
    const { data, error } = await client.rpc('search_books', {
      p_search_term: searchTerm,
      p_page_number: page,
      p_page_size: pageSize
    });
    return { data, error: error as PostgrestError | null };
  } else {
    // Default fetch without search
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await client
      .from('books')
      .select('id, book_name, author, isbn, genre, added_by, created_at, updated_at, ai_status, wants_to_read')
      // Order by wants_to_read first to bring marked items to the top; place NULLs last
      .order('wants_to_read', { ascending: false, nullsFirst: false })
      // Then order by most recent creation time
      .order('created_at', { ascending: false })
      .range(from, to);
    return { data, error };
  }
};

export const getBooksCount = async (client: SupabaseClient, searchTerm: string = ''): Promise<{ count: number | null; error: PostgrestError | null }> => {
    if (searchTerm) {
        const { data, error } = await client.rpc('search_books_count', {
            p_search_term: searchTerm
        });
        return { count: data, error: error as PostgrestError | null };
    } else {
        const { count, error } = await client
          .from('books')
          .select('*', { count: 'exact', head: true });
        return { count, error };
    }
};

export const getBookSummary = async (client: SupabaseClient, id: string): Promise<{ data: { summary: string | null, book_name: string, isbn: string | null } | null; error: PostgrestError | null }> => {
    const { data, error } = await client
      .from('books')
      .select('summary, book_name, isbn')
      .eq('id', id)
      .single();
    return { data, error };
};

export const addBook = async (client: SupabaseClient, book: Omit<Book, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Book[] | null; error: PostgrestError | null }> => {
  const { data, error } = await client
    .from('books')
    .insert([book])
    .select();
  return { data, error };
};

export const updateBook = async (client: SupabaseClient, id: string, updates: Partial<Book>): Promise<{ data: Book[] | null; error: PostgrestError | null }> => {
  const { data, error } = await client
    .from('books')
    .update(updates)
    .eq('id', id)
    .select();
  return { data, error };
};

export const deleteBook = async (client: SupabaseClient, id: string): Promise<{ error: PostgrestError | null }> => {
  const { error } = await client
    .from('books')
    .delete()
    .eq('id', id);
  return { error };
};
