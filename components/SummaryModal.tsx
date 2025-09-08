import React from 'react';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string | null;
  title: string;
  isbn: string | null;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, summary, title, isbn }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate" title={title}>
            Özet: {title}
          </h2>
          {isbn && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              ISBN: {isbn}
            </p>
          )}
        </header>
        <main className="p-6 flex-grow overflow-y-auto">
          <p className="text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {summary || 'Bu kitap için bir özet bulunmuyor.'}
          </p>
        </main>
        <footer className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Kapat
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SummaryModal;
