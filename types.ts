export interface SupabaseConfig {
  supabase: {
    url: string;
    anonKey: string;
  }
}

export interface Book {
  id?: string;
  book_name: string;
  author: string;
  isbn: string | null;
  summary: string | null;
  genre: string | null;
  added_by: string;
  created_at?: string;
  updated_at?: string;
  ai_status?: 'in_progress' | 'completed' | 'failed' | null;
}