import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { setAuthToken } from '../utils/api';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const { user, isLoading, setUser, setLoading, sessionToken } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        // Check URL for session_id from Emergent Auth
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          const params = new URLSearchParams(hash.substring(1));
          const sessionId = params.get('session_id');
          
          if (sessionId) {
            // Process session_id
            // This will be handled by the login screen
            setLoading(false);
            return;
          }
        }
        
        // Check if we have a session token
        if (sessionToken) {
          setAuthToken(sessionToken);
        }
        
        setLoading(false);
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
        router.replace('/(customer)');
      } else if (user.role === 'restaurant') {
        router.replace('/(restaurant)');
      } else if (user.role === 'rider') {
        router.replace('/(rider)');
      }
    }
  }, [user, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(restaurant)" />
      <Stack.Screen name="(rider)" />
    </Stack>
  );
}
