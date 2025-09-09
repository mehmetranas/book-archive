import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Book } from '../types';
import { getBooks, addBook, updateBook, deleteBook, getBookSummary, getBooksCount } from '../services/supabaseService';
import BookList from './BookTable';
import BookForm from './BookForm';
import SummaryModal from './SummaryModal';
import ConfirmationModal from './ConfirmationModal';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import { PlusIcon, LogoutIcon, InstallIcon } from './icons';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string
  }>;
  prompt(): Promise<void>;
}

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
  const [summaryModalContent, setSummaryModalContent] = useState<{ 
    summary: string | null, 
    title: string, 
    isbn: string | null,
    pageCount: number | null,
    subtitle: string | null,
    isLoading: boolean
  }>({ summary: null, title: '', isbn: null, pageCount: null, subtitle: null, isLoading: false });
  const { message: toastMessage, isVisible: isToastVisible, showToast, hideToast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

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
    setIsSummaryModalOpen(true);
    setSummaryModalContent({ 
        summary: null, 
        title: 'Yükleniyor...', 
        isbn: null, 
        pageCount: null, 
        subtitle: null, 
        isLoading: true 
    });

    const { data: summaryData, error: summaryError } = await getBookSummary(supabaseClient, id);

    if (summaryError) {
        setSummaryModalContent({ 
            summary: `Özet alınamadı: ${summaryError.message}`, 
            title: 'Hata', 
            isbn: null, 
            pageCount: null, 
            subtitle: null, 
            isLoading: false 
        });
        return;
    } 
    
    if (summaryData) {
        let pageCountFromApi: number | null = null;
        let subtitleFromApi: string | null = null;

        if (summaryData.isbn) {
            try {
                const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${summaryData.isbn}`);
                const data = await response.json();
                const volumeInfo = data.items?.[0]?.volumeInfo;
                pageCountFromApi = volumeInfo?.pageCount || null;
                subtitleFromApi = volumeInfo?.subtitle || null;
            } catch (error) {
                console.error("Error fetching book details:", error);
            }
        }

        setSummaryModalContent({ 
            summary: summaryData.summary, 
            title: summaryData.book_name, 
            isbn: summaryData.isbn, 
            pageCount: pageCountFromApi, 
            subtitle: subtitleFromApi, 
            isLoading: false 
        });
    }
  };

  const handleToggleWantsToRead = async (book: Book) => {
    // Optimistic UI update
    const updatedBooks = books.map(b => 
      b.id === book.id ? { ...b, wants_to_read: !b.wants_to_read } : b
    );
    setBooks(updatedBooks);

    // Update the database
    const { error } = await updateBook(supabaseClient, book.id!, { wants_to_read: !book.wants_to_read });

    if (error) {
      alert(`"Okuma Listesi" durumu güncellenirken hata oluştu: ${error.message}`);
      // Rollback on error
      setBooks(books);
    }
  };

  const handleCopy = (bookName: string, author: string) => {
    const textToCopy = `${bookName} - ${author}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast('Panoya kopyalandı!');
    }).catch(err => {
      console.error('Kopyalama işlemi başarısız oldu: ', err);
      showToast('Kopyalama başarısız oldu.');
    });
  };

  const handleDeleteRequest = (id: string) => {
    setBookToDelete(id);
    setIsConfirmationModalOpen(true);
  };

  const handleDelete = async () => {
    if (!bookToDelete) return;
    
    const { error } = await deleteBook(supabaseClient, bookToDelete);
    if (error) {
      alert(`Kitap silinirken hata oluştu: ${error.message}`);
    } else {
      setBooks(books.filter(b => String(b.id) !== bookToDelete));
      setTotalBooks(prev => prev - 1); // Decrement total books count
    }
    
    setIsConfirmationModalOpen(false);
    setBookToDelete(null);
  };

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
        } else {
          console.log('User dismissed the A2HS prompt');
        }
        setInstallPrompt(null);
      });
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
            {installPrompt && (
              <button
                onClick={handleInstallClick}
                title="Uygulamayı Yükle"
                className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <InstallIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            <button
              onClick={onLogout}
              title="Yapılandırmayı Sıfırla"
              className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <LogoutIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center justify-center p-2 border border-transparent rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105"
              title="Yeni Kitap Ekle"
            >
              <PlusIcon className="w-6 h-6" />
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
              <BookList 
                books={books} 
                onEdit={handleOpenModal} 
                onDelete={handleDeleteRequest} 
                onAiTrigger={handleAiTrigger} 
                onViewSummary={handleViewSummary}
                onToggleWantsToRead={handleToggleWantsToRead}
                onCopy={handleCopy}
              />
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
        subtitle={summaryModalContent.subtitle}
        isbn={summaryModalContent.isbn}
        pageCount={summaryModalContent.pageCount}
        isLoading={summaryModalContent.isLoading}
      />
      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        onConfirm={handleDelete}
        title="Kitabı Sil"
        message="Bu kitabı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
      />
      <Toast message={toastMessage} isVisible={isToastVisible} onClose={hideToast} />
    </div>
  );
};

export default Dashboard;