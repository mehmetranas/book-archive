import React from 'react';
import type { Book } from '../types';
import { EditIcon, DeleteIcon, AiIcon, InfoIcon, BookmarkIcon, BookmarkFilledIcon } from './icons';

interface BookListProps {
  books: Book[];
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  onAiTrigger: (id: string) => void;
  onViewSummary: (id: string) => void;
  onToggleWantsToRead: (book: Book) => void;
}

const AiStatusBadge: React.FC<{ status: 'in_progress' | 'completed' | 'failed' }> = ({ status }) => {
    const statusConfig = {
      in_progress: {
        text: 'İşleniyor',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      },
      completed: {
        text: 'Tamamlandı',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      },
      failed: {
        text: 'Hata',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      },
    };
  
    const config = statusConfig[status];
  
    if (!config) return null;
  
    return (
      <span 
        className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${config.color}`}
        title={config.text}
      >
        AI
      </span>
    );
  };
  

const BookList: React.FC<BookListProps> = ({ books, onEdit, onDelete, onAiTrigger, onViewSummary, onToggleWantsToRead }) => {

  if(books.length === 0){
    return (
        <div className="text-center py-16 px-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Henüz kitap yok</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Başlamak için yeni bir kitap ekleyin.</p>
        </div>
    )
  }

  return (
    <div className="space-y-4">
      {books.map((book) => (
        <div 
          key={book.id} 
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 flex flex-col space-y-3"
        >
          {/* Top Row */}
          <div className="flex justify-between items-start">
            <div className="flex-grow min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate" title={book.book_name}>
                {book.book_name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate" title={book.author}>
                {book.author}
              </p>
            </div>
            <div className="flex-shrink-0 flex items-center space-x-2 ml-4">
              <button
                onClick={() => onToggleWantsToRead(book)}
                className="p-1.5 rounded-full text-gray-400 hover:text-indigo-500 transition-colors"
                title={book.wants_to_read ? "Okuma listesinden çıkar" : "Okuma listesine ekle"}
              >
                {book.wants_to_read ? <BookmarkFilledIcon className="w-5 h-5 text-indigo-500" /> : <BookmarkIcon className="w-5 h-5" />}
              </button>
              {book.ai_status && <AiStatusBadge status={book.ai_status} />}
              <button
                onClick={() => book.id && onAiTrigger(book.id)}
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="AI İşlemini Tetikle"
                disabled={book.ai_status === 'in_progress'}
              >
                <AiIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex justify-between items-center">
            <div>
              {book.genre && (
                <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-indigo-900 dark:text-indigo-300">
                  {book.genre}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <button onClick={() => book.id && onDelete(book.id)} className="p-2 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-gray-700 transition-colors" title="Sil">
                  <DeleteIcon className="w-5 h-5"/>
              </button>
              <button onClick={() => onEdit(book)} className="p-2 rounded-full text-gray-500 hover:text-yellow-600 hover:bg-yellow-100 dark:hover:text-yellow-400 dark:hover:bg-gray-700 transition-colors" title="Düzenle">
                  <EditIcon className="w-5 h-5"/>
              </button>
              <button onClick={() => book.id && onViewSummary(book.id)} className="p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:text-blue-400 dark:hover:bg-gray-700 transition-colors" title="Özeti Görüntüle">
                  <InfoIcon className="w-5 h-5"/>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BookList;