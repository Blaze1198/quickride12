import { create } from 'zustand';
import { Platform } from 'react-native';

// Platform-specific storage - using localStorage for web compatibility
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key);
    }
  },
};

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'customer' | 'restaurant' | 'rider' | 'admin';
  phone?: string;
}

interface AuthStore {
  user: User | null;
  sessionToken: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSessionToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  sessionToken: null,
  isLoading: true,
  setUser: (user) => {
    set({ user });
    if (user) {
      storage.setItem('user', JSON.stringify(user));
    } else {
      storage.removeItem('user');
    }
  },
  setSessionToken: (token) => {
    set({ sessionToken: token });
    if (token) {
      storage.setItem('sessionToken', token);
    } else {
      storage.removeItem('sessionToken');
    }
  },
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => {
    set({ user: null, sessionToken: null });
    storage.removeItem('user');
    storage.removeItem('sessionToken');
  },
  initializeAuth: async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        storage.getItem('sessionToken'),
        storage.getItem('user'),
      ]);

      if (storedToken && storedUser) {
        set({
          sessionToken: storedToken,
          user: JSON.parse(storedUser),
        });
        
        // Immediately set the auth token in API headers
        const { setAuthToken } = require('../utils/api');
        setAuthToken(storedToken);
        console.log('✅ Auth token set in API headers during initialization');
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
