import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://track-delivery-5.preview.emergentagent.com';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add auth token to requests
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('✅ Auth token set in API headers');
  } else {
    delete api.defaults.headers.common['Authorization'];
    console.log('🔓 Auth token removed from API headers');
  }
};

// Function to restore token from localStorage
const restoreAuthToken = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedToken = localStorage.getItem('sessionToken');
    if (storedToken && !authToken) {
      setAuthToken(storedToken);
      console.log('🔄 Auth token restored from localStorage');
    }
  }
};

// Restore token on module load
restoreAuthToken();

// Add request interceptor to ensure token is always present
api.interceptors.request.use(
  (config) => {
    // If no auth header but we have token in localStorage, restore it
    if (!config.headers.Authorization) {
      restoreAuthToken();
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Multiple event listeners for better browser compatibility
if (typeof window !== 'undefined') {
  // Primary: visibilitychange (modern browsers)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      restoreAuthToken();
      console.log('👁️ Tab visible (visibilitychange) - auth token checked');
    }
  });

  // Backup: focus event (when window regains focus)
  window.addEventListener('focus', () => {
    restoreAuthToken();
    console.log('👁️ Window focused - auth token checked');
  });

  // Additional: pageshow (when page becomes visible, including from cache)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      // Page loaded from cache (bfcache)
      restoreAuthToken();
      console.log('👁️ Page shown from cache - auth token checked');
    }
  });
}

export default api;
