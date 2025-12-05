import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AppMode = 'books' | 'movies';

type ModeContextType = {
    mode: AppMode;
    toggleMode: () => Promise<void>;
    setMode: (mode: AppMode) => Promise<void>;
};

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const useMode = () => {
    const context = useContext(ModeContext);
    if (!context) {
        throw new Error('useMode must be used within ModeProvider');
    }
    return context;
};

type ModeProviderProps = {
    children: ReactNode;
};

export const ModeProvider = ({ children }: ModeProviderProps) => {
    const [mode, setModeState] = useState<AppMode>('books');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadMode = async () => {
            try {
                const storedMode = await AsyncStorage.getItem('app_mode');
                if (storedMode === 'books' || storedMode === 'movies') {
                    setModeState(storedMode);
                }
            } catch (error) {
                console.error('Failed to load app mode:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadMode();
    }, []);

    const setMode = async (newMode: AppMode) => {
        try {
            await AsyncStorage.setItem('app_mode', newMode);
            setModeState(newMode);
        } catch (error) {
            console.error('Failed to save app mode:', error);
        }
    };

    const toggleMode = async () => {
        const newMode = mode === 'books' ? 'movies' : 'books';
        await setMode(newMode);
    };

    if (isLoading) {
        return null; // Or a splash screen
    }

    return (
        <ModeContext.Provider value={{ mode, toggleMode, setMode }}>
            {children}
        </ModeContext.Provider>
    );
};
