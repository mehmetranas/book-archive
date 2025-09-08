import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Book } from '../types';
import { getBooks, addBook, updateBook, deleteBook, getBookSummary, getBooksCount } from '../services/supabaseService';
import BookList from './BookTable';
import BookForm from './BookForm';
import SummaryModal from './SummaryModal';
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
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryModalContent, setSummaryModalContent] = useState<{ summary: string | null, title: string, isbn: string | null }>({ summary: null, title: '', isbn: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const booksPerPage = 10;
  const effectRan = useRef(false);
  const isInitialSearchMount = useRef(true);


  const fetchBooks = useCallback(async (page: number, search: string) => {
    setIsLoading(true);
    setError(null);
    const { data, error } = await getBooks(supabaseClient, page, booksPerPage, search);
    if (error) {
      setError(`Kitaplar alınamadı: ${error.message}`);
    } else if (data) {
      setBooks(data);
    }

    const { count, error: countError } = await getBooksCount(supabaseClient, search);
    if (countError) {
        setError(`Toplam kitap sayısı alınamadı: ${countError.message}`);
    } else if (count !== null) {
        setTotalBooks(count);
    }

    setIsLoading(false);
  }, [supabaseClient]);

  useEffect(() => {
    if (effectRan.current === false) {
      fetchBooks(1, searchTerm);

      return () => {
        effectRan.current = true;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // an empty dependency array ensures this runs only once.

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  useEffect(() => {
    // a search was initiated or cleared
    if (isInitialSearchMount.current) {
      isInitialSearchMount.current = false;
      return;
    }
    setCurrentPage(1);
    fetchBooks(1, debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchBooks]);


  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchBooks(newPage, debouncedSearchTerm);
  }

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

  const handleViewSummary = async (id: string) => {
    setSummaryModalContent({ summary: 'Yükleniyor...', title: 'Özet', isbn: null });
    setIsSummaryModalOpen(true);

    const { data, error } = await getBookSummary(supabaseClient, id);

    if (error) {
        setSummaryModalContent({ summary: `Özet alınamadı: ${error.message}`, title: 'Hata', isbn: null });
    } else if (data) {
        setSummaryModalContent({ summary: data.summary, title: data.book_name, isbn: data.isbn });
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
        <header className="flex flex-col md:flex-row justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Kitaplık</h1>
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <input
              type="text"
              placeholder="Kitap veya yazar ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full md:w-64 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center justify-center p-2 border border-transparent rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105"
              title="Yeni Kitap Ekle"
            >
              <PlusIcon className="w-6 h-6" />
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
              <button onClick={() => fetchBooks(currentPage, debouncedSearchTerm)} className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Tekrar Dene</button>
            </div>
          ) : (
            <>
              <BookList books={books} onEdit={handleOpenModal} onDelete={handleDelete} onAiTrigger={handleAiTrigger} onViewSummary={handleViewSummary} />
              <div className="mt-6 flex justify-between items-center">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Önceki
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Sayfa {currentPage} / {Math.ceil(totalBooks / booksPerPage)}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(totalBooks / booksPerPage)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sonraki
                </button>
              </div>
            </>
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
      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summary={summaryModalContent.summary}
        title={summaryModalContent.title}
        isbn={summaryModalContent.isbn}
      />
    </div>
  );
};

export default Dashboard;