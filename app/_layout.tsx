import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { setAuthToken } from '../utils/api';
import { View, ActivityIndicator } from 'react-native';
import { NavigationThemeProvider } from '../components/NavigationThemeProvider';

export default function RootLayout() {
  const { user, isLoading, setUser, setLoading, sessionToken, initializeAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Initialize auth store with persisted data
    const checkSession = async () => {
      try {
        // First, load persisted auth data from AsyncStorage
        await initializeAuth();
        
        // Check URL for session_id from Emergent Auth
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          const params = new URLSearchParams(hash.substring(1));
          const sessionId = params.get('session_id');
          
          if (sessionId) {
            // Process session_id
            // This will be handled by the login screen
            return;
          }
        }
        
        // Set auth token in API if we have one
        const currentToken = useAuthStore.getState().sessionToken;
        if (currentToken) {
          setAuthToken(currentToken);
          console.log('✅ Session token loaded and set in API');
        }
      } catch (error) {
        console.error('Session check error:', error);
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect based on role
      if (user.role === 'customer') {
        router.replace('/service-selection');
      } else if (user.role === 'restaurant') {
        router.replace('/(restaurant)');
      } else if (user.role === 'rider') {
        router.replace('/(rider)');
      } else if (user.role === 'admin') {
        router.replace('/(admin)');
      }
    }
  }, [user, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#210059" />
      </View>
    );
  }

  return (
    <NavigationThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(restaurant)" />
        <Stack.Screen name="(rider)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </NavigationThemeProvider>
  );
}
