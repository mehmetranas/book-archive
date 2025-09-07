import React, { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Book } from '../types';
import { getBooks, addBook, updateBook, deleteBook } from '../services/supabaseService';
import BookList from './BookTable';
import BookForm from './BookForm';
import { PlusIcon, LogoutIcon } from './icons';

interface DashboardProps {
  supabaseClient: SupabaseClient;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ supabaseClient, onLogout }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error } = await getBooks(supabaseClient);
    if (error) {
      setError(`Kitaplar alınamadı: ${error.message}`);
    } else if (data) {
      setBooks(data);
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseClient]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleOpenModal = (book: Book | null = null) => {
    setEditingBook(book);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBook(null);
  };

  const handleSubmit = async (bookData: Book) => {
    if (editingBook && editingBook.id) {
      // Update
      const { data, error } = await updateBook(supabaseClient, editingBook.id, bookData);
      if (error) {
        alert(`Kitap güncellenirken hata oluştu: ${error.message}`);
      } else if (data) {
        setBooks(books.map(b => b.id === editingBook.id ? data[0] : b));
      }
    } else {
      // Add
      const newBookData = { ...bookData, ai_status: 'in_progress' as const };
      const { data, error } = await addBook(supabaseClient, newBookData);
      if (error) {
        alert(`Kitap eklenirken hata oluştu: ${error.message}`);
      } else if (data) {
        setBooks([data[0], ...books]);
      }
    }
    handleCloseModal();
  };

  const handleAiTrigger = async (id: string) => {
    const bookToUpdate = books.find(b => b.id === id);
    if (!bookToUpdate || bookToUpdate.ai_status === 'in_progress') return;

    const originalStatus = bookToUpdate.ai_status;
    setBooks(books.map(b => b.id === id ? { ...b, ai_status: 'in_progress' } : b));

    const { error } = await updateBook(supabaseClient, id, { ai_status: 'in_progress' });

    if (error) {
      alert(`AI durumu güncellenirken hata oluştu: ${error.message}`);
      setBooks(books.map(b => b.id === id ? { ...b, ai_status: originalStatus } : b));
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Bu kitabı silmek istediğinizden emin misiniz?")) {
      const { error } = await deleteBook(supabaseClient, id);
      if (error) {
        alert(`Kitap silinirken hata oluştu: ${error.message}`);
      } else {
        setBooks(books.filter(b => String(b.id) !== id));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-3xl font-bold tracking-tight">Kitap Arşivi</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Yeni Kitap Ekle
            </button>
            <button
              onClick={onLogout}
              title="Yapılandırmayı Sıfırla"
              className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <LogoutIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </header>

        <main>
          {isLoading ? (
            <div className="text-center py-10">
              <p>Kitaplar yükleniyor...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-200 p-4 rounded-md">
              <p>{error}</p>
              <button onClick={fetchBooks} className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Tekrar Dene</button>
            </div>
          ) : (
            <BookList books={books} onEdit={handleOpenModal} onDelete={handleDelete} onAiTrigger={handleAiTrigger} />
          )}
        </main>
      </div>
      {isModalOpen && (
        <BookForm
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleSubmit}
          initialData={editingBook}
        />
      )}
    </div>
  );
};

export default Dashboard;