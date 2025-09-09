import React from 'react';
import type { Book } from '../types';
import { AiIcon, InfoIcon, BookmarkIcon, BookmarkFilledIcon, CopyIcon, FlipVerticalIcon } from './icons';

interface BookListProps {
  books: Book[];
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  onAiTrigger: (id: string) => void;
  onViewSummary: (id: string) => void;
  onToggleWantsToRead: (book: Book) => void;
  onCopy: (bookName: string, author: string) => void;
  onArchiveToggle?: (id: string, archived: boolean) => void;
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
  

const BookList: React.FC<BookListProps> = ({ books, onEdit, onDelete, onAiTrigger, onViewSummary, onToggleWantsToRead, onCopy, onArchiveToggle }) => {
  const [flippedId, setFlippedId] = React.useState<string | null>(null);

  // Ensure default front face on data changes (e.g., leaving filters)
  React.useEffect(() => {
    setFlippedId(null);
  }, [books]);

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
      {books.map((book) => {
        const key = String(book.id ?? '');
        const isFlipped = flippedId === key;
        const toggleFlip = () => setFlippedId(prev => (prev === key ? null : key));
        return (
          <div key={book.id} className="relative" style={{ perspective: 1000 }}>
            <div
              className="rounded-lg shadow-md hover:shadow-lg transition-shadow"
              style={{ transformStyle: 'preserve-3d', transform: `rotateX(${isFlipped ? 180 : 0}deg)`, transition: 'transform 300ms ease' }}
              onClick={toggleFlip}
            >
              {/* Flip icon overlay (single button at bottom-left) */}
              <button
                type="button"
                className="absolute bottom-1 left-0 z-10 p-1 rounded hover:bg-gray-200/70 dark:hover:bg-gray-700/70"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => { e.stopPropagation(); toggleFlip(); }}
                title="Çevir"
                aria-label="Çevir"
              >
                <FlipVerticalIcon className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              </button>
              {/* Front Face */}
              <div
                className="bg-white dark:bg-gray-800 rounded-lg p-4 flex flex-col space-y-3"
                style={{ backfaceVisibility: 'hidden' }}
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
                      onClick={(e) => { e.stopPropagation(); onToggleWantsToRead(book); }}
                      className="p-1.5 rounded-full text-gray-400 hover:text-indigo-500 transition-colors"
                      title={book.wants_to_read ? "Okuma listesinden çıkar" : "Okuma listesine ekle"}
                    >
                      {book.wants_to_read ? <BookmarkFilledIcon className="w-5 h-5 text-indigo-500" /> : <BookmarkIcon className="w-5 h-5" />}
                    </button>
                    {book.ai_status && <AiStatusBadge status={book.ai_status} />}
                    <button
                      onClick={(e) => { e.stopPropagation(); book.id && onAiTrigger(book.id); }}
                      className="p-1.5 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="AI İşlemini Tetikle"
                      disabled={book.ai_status === 'in_progress'}
                    >
                      <AiIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Row (front): genre + copy/info */}
                <div className="flex justify-between items-center">
                  <div>
                    {book.genre && (
                      <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-indigo-900 dark:text-indigo-300">
                        {book.genre}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <button onClick={(e) => { e.stopPropagation(); onCopy(book.book_name, book.author); }} className="p-2 rounded-full text-gray-500 hover:text-green-600 hover:bg-green-100 dark:hover:text-green-400 dark:hover:bg-gray-700 transition-colors" title="Kopyala">
                        <CopyIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); book.id && onViewSummary(book.id); }} className="p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:text-blue-400 dark:hover:bg-gray-700 transition-colors" title="Özeti Görüntüle">
                        <InfoIcon className="w-5 h-5"/>
                    </button>
                  </div>
                </div>
              </div>

              {/* Back Face */}
              <div
                className="bg-white dark:bg-gray-800 rounded-lg p-4 flex flex-col space-y-3 absolute inset-0"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-grow min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white truncate" title={book.book_name}>
                      {book.book_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate" title={book.author}>
                      {book.author}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <button onClick={(e) => { e.stopPropagation(); book.id && onDelete(book.id); }} className="px-3 py-2 rounded-md text-red-600 bg-red-100 hover:bg-red-200 dark:text-red-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors" title="Sil">
                      Sil
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); book.id && onArchiveToggle && onArchiveToggle(book.id, !book.archived); }}
                      className="px-3 py-2 rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 dark:text-yellow-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                      title={book.archived ? "Arşivden çıkar" : "Arşivle"}
                    >
                      {book.archived ? 'Arşivden çıkar' : 'Arşivle'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(book); }} className="px-3 py-2 rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 dark:text-yellow-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors" title="Düzenle">
                      Düzenle
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BookList;