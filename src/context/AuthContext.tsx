import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pb, User } from '../services/pocketbase';

type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, passwordConfirm: string, name?: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

type AuthProviderProps = {
    children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const queryClient = useQueryClient();

    useEffect(() => {
        // Initialize auth state from stored token
        const initAuth = async () => {
            try {
                if (!pb.authStore.isValid) {
                    const storedAuth = await AsyncStorage.getItem('pb_auth');
                    if (storedAuth) {
                        const parsed = JSON.parse(storedAuth);
                        if (parsed && parsed.token) {
                            pb.authStore.save(parsed.token, parsed.model);

                            if (parsed.model) {
                                setUser(parsed.model as unknown as User);
                            } else {
                                // Token exists but no model - refresh to get user data
                                try {
                                    const refreshed = await pb.collection('users').authRefresh();
                                    setUser(refreshed.record as unknown as User);
                                } catch (e) {
                                    pb.authStore.clear();
                                }
                            }
                        }
                    }
                } else {
                    if (pb.authStore.model) {
                        setUser(pb.authStore.model as unknown as User);
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();

        // Listen to auth state changes
        const unsubscribe = pb.authStore.onChange((token, model) => {
            setUser(model as User | null);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const authData = await pb
                .collection('users')
                .authWithPassword(email, password);
            setUser(authData.record as User);
        } catch (error: any) {
            throw new Error(error?.message || 'Login failed');
        }
    };

    const register = async (
        email: string,
        password: string,
        passwordConfirm: string,
        name?: string,
    ) => {
        try {
            const data: any = {
                email,
                password,
                passwordConfirm,
            };

            if (name) {
                data.name = name;
            }

            await pb.collection('users').create(data);

            // Auto login after registration
            await login(email, password);
        } catch (error: any) {
            throw new Error(error?.message || 'Registration failed');
        }
    };

    const logout = async () => {
        pb.authStore.clear();
        setUser(null);
        queryClient.clear();
    };

    const value: AuthContextType = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
