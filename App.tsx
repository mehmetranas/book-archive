
import React, { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseConfig } from './types';
import ConfigScreen from './components/ConfigScreen';
import Dashboard from './components/Dashboard';
import { initializeSupabase } from './services/supabaseService';

const App: React.FC = () => {
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('supabaseConfig');
      if (savedConfig) {
        const config: SupabaseConfig = JSON.parse(savedConfig);
        // Check for the new structure before initializing
        if (config.supabase && config.supabase.url && config.supabase.anonKey) {
          const client = initializeSupabase(config);
          setSupabaseClient(client);
        } else {
            // If the old format is found, clear it to force re-upload
            console.warn("Eski veya geçersiz yapılandırma formatı bulundu. Lütfen yeniden yapılandırın.");
            localStorage.removeItem('supabaseConfig');
        }
      }
    } catch (error) {
      console.error("Yapılandırma yüklenirken hata oluştu:", error);
      localStorage.removeItem('supabaseConfig');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleConfigLoaded = (config: SupabaseConfig) => {
    try {
      localStorage.setItem('supabaseConfig', JSON.stringify(config));
      const client = initializeSupabase(config);
      setSupabaseClient(client);
    } catch (error) {
      console.error("Yapılandırma kaydedilirken hata:", error);
      alert("Yapılandırma kaydedilirken bir hata oluştu.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('supabaseConfig');
    setSupabaseClient(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">Yükleniyor...</div>
      </div>
    );
  }

  if (!supabaseClient) {
    return <ConfigScreen onConfigLoaded={handleConfigLoaded} />;
  }

  return <Dashboard supabaseClient={supabaseClient} onLogout={handleLogout} />;
};

export default App;
