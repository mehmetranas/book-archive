import React, { createContext, useContext, useEffect, useState } from 'react';
import { pb } from '../services/pocketbase';

// Tip Tanımları
interface AIConfig {
    enrichment_cost: number;
    promo_text: string;
    is_enabled: boolean;
}

interface SystemSettings {
    ai_pricing: AIConfig;
}

interface ConfigContextData {
    aiConfig: AIConfig;
    isLoading: boolean;
    refreshConfig: () => Promise<void>;
}

// Varsayılan Değerler (İnternet yoksa veya yüklenirken kullanılır)
const DEFAULT_CONFIG: AIConfig = {
    enrichment_cost: 0,
    promo_text: '',
    is_enabled: true,
};

const ConfigContext = createContext<ConfigContextData>({
    aiConfig: DEFAULT_CONFIG,
    isLoading: true,
    refreshConfig: async () => { },
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            // system_settings tablosundaki ilk kaydı alıyoruz
            const list = await pb.collection('system_settings').getList(1, 1);
            if (list.items.length > 0) {
                const settings = list.items[0];
                if (settings.ai_pricing) {
                    setAiConfig(settings.ai_pricing);
                }
            }
        } catch (error) {
            console.log('Failed to fetch system settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        console.log("ConfigContext: Initializing and fetching settings...");
        fetchSettings();

        // Realtime: Ayar değiştiği an tüm cihazlarda güncellenir
        pb.collection('system_settings').subscribe('*', (e) => {
            console.log("ConfigContext: Realtime Event Received:", e.action, e.record);
            if (e.action === 'update' && e.record.ai_pricing) {
                let newConfig = e.record.ai_pricing;

                // Güvenli JSON parse (Bazen string gelebilir)
                if (typeof newConfig === 'string') {
                    try {
                        newConfig = JSON.parse(newConfig);
                    } catch (err) {
                        console.error("ConfigContext: JSON Parse Error", err);
                        return;
                    }
                }

                console.log('Dynamic Config Updated:', newConfig);
                setAiConfig(newConfig);
            }
        }).catch((err) => console.error("ConfigContext: Subscribe Error:", err));

        return () => {
            console.log("ConfigContext: Unsubscribing...");
            pb.collection('system_settings').unsubscribe('*');
        };
    }, []);

    return (
        <ConfigContext.Provider value={{ aiConfig, isLoading, refreshConfig: fetchSettings }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => useContext(ConfigContext);
