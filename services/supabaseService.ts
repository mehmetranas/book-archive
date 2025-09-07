
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

export const getBooks = async (client: SupabaseClient): Promise<{ data: Book[] | null; error: PostgrestError | null }> => {
  const { data, error } = await client
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });
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
