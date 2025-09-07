
import React, { useState } from 'react';
import type { SupabaseConfig } from '../types';

interface ConfigScreenProps {
  onConfigLoaded: (config: SupabaseConfig) => void;
}

const ConfigScreen: React.FC<ConfigScreenProps> = ({ onConfigLoaded }) => {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error("Dosya içeriği okunamadı.");
        }
        const config = JSON.parse(text);
        // Updated validation for the new config structure
        if (config.supabase && config.supabase.url && config.supabase.anonKey) {
          onConfigLoaded(config);
        } else {
          throw new Error("Geçersiz yapılandırma dosyası. 'supabase: { url, anonKey }' alanları zorunludur.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-2xl dark:bg-gray-800">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Supabase Yapılandırması
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Başlamak için lütfen Supabase yapılandırma JSON dosyanızı yükleyin.
          </p>
        </div>
        <div className="flex justify-center">
            <label htmlFor="config-upload" className="cursor-pointer inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Dosya Seç
            <input
                id="config-upload"
                type="file"
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
            />
            </label>
        </div>
        {error && (
          <div className="p-4 mt-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800" role="alert">
            <span className="font-medium">Hata!</span> {error}
          </div>
        )}
         <div className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
          <p>Yapılandırma dosyanız sadece tarayıcınızda saklanır ve hiçbir yere gönderilmez.</p>
        </div>
      </div>
    </div>
  );
};

export default ConfigScreen;
