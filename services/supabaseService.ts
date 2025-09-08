
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
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from('books')
    .select('id, book_name, author, isbn, genre, added_by, created_at, updated_at, ai_status')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchTerm) {
    query = query.or(`book_name.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
  }

  const { data, error } = await query;
  return { data, error };
};

export const getBooksCount = async (client: SupabaseClient, searchTerm: string = ''): Promise<{ count: number | null; error: PostgrestError | null }> => {
    let query = client
      .from('books')
      .select('*', { count: 'exact', head: true });

    if (searchTerm) {
      query = query.or(`book_name.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
    }

    const { count, error } = await query;
    return { count, error };
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
