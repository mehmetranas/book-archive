import React, { useState, useEffect } from 'react';
import type { Book } from '../types';

interface BookFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (book: Book) => void;
  initialData?: Book | null;
}

const BookForm: React.FC<BookFormProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
  const [formData, setFormData] = useState<Omit<Book, 'id' | 'created_at' | 'updated_at'>>({
    book_name: '',
    author: '',
    isbn: '',
    summary: '',
    genre: '',
    added_by: 'mehmet',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        book_name: '',
        author: '',
        isbn: '',
        summary: '',
        genre: '',
        added_by: 'mehmet',
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.book_name) {
        alert("Lütfen Kitap Adı alanını doldurun.");
        return;
    }
    onSubmit(formData as Book);
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {initialData ? 'Kitabı Düzenle' : 'Yeni Kitap Ekle'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="book_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kitap Adı</label>
              <input type="text" name="book_name" id="book_name" value={formData.book_name} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required/>
            </div>
            <div>
              <label htmlFor="author" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Yazar</label>
              <input type="text" name="author" id="author" value={formData.author} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
            </div>
            <div>
              <label htmlFor="genre" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tür</label>
              <input type="text" name="genre" id="genre" value={formData.genre ?? ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="Örn: Roman, Bilim Kurgu"/>
            </div>
            <div>
              <label htmlFor="isbn" className="block text-sm font-medium text-gray-700 dark:text-gray-300">ISBN</label>
              <input type="text" name="isbn" id="isbn" value={formData.isbn ?? ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
            </div>
            <div>
              <label htmlFor="summary" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Özet</label>
              <textarea name="summary" id="summary" value={formData.summary ?? ''} onChange={handleChange} rows={4} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"></textarea>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">İptal</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                {initialData ? 'Kaydet' : 'Ekle'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BookForm;