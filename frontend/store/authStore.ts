import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'customer' | 'restaurant' | 'rider';
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
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  sessionToken: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSessionToken: (token) => set({ sessionToken: token }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, sessionToken: null }),
}));
