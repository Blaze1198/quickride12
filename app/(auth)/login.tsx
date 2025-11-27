import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import api, { setAuthToken } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

const AUTH_URL = 'https://auth.emergentagent.com';
const REDIRECT_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://gps-pilot.preview.emergentagent.com';

export default function LoginScreen() {
  const router = useRouter();
  const { setUser, setSessionToken, setLoading } = useAuthStore();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Check for session_id in URL
    const checkSessionId = async () => {
      try {
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          const params = new URLSearchParams(hash.substring(1));
          const sessionId = params.get('session_id');

          if (sessionId) {
            setProcessing(true);
            await processSession(sessionId);
            // Clear hash from URL
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
        setProcessing(false);
      }
    };

    checkSessionId();
  }, []);

  const processSession = async (sessionId: string) => {
    try {
      const response = await api.post('/auth/session', {
        session_id: sessionId,
        role: 'customer', // Default to customer role for OAuth
      });

      const { user, session_token } = response.data;

      setUser(user);
      setSessionToken(session_token);
      setAuthToken(session_token);

      // Navigate based on role
      if (user.role === 'customer') {
        router.replace('/service-selection');
      } else if (user.role === 'restaurant') {
        router.replace('/(restaurant)');
      } else if (user.role === 'rider') {
        router.replace('/(rider)');
      } else if (user.role === 'admin') {
        router.replace('/(admin)');
      }
    } catch (error) {
      console.error('Session processing error:', error);
      alert('Failed to sign in. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleLogin = () => {
    const redirectUrl = encodeURIComponent(`${REDIRECT_URL}`);
    const authUrl = `${AUTH_URL}/?redirect=${redirectUrl}`;
    Linking.openURL(authUrl);
  };

  if (processing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#210059" />
          <Text style={styles.loadingText}>Signing you in...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name="fast-food" size={80} color="#210059" />
            <Text style={styles.title}>QuickRide</Text>
            <Text style={styles.subtitle}>Food & Ride Services at Your Fingertips</Text>
          </View>

          <View style={styles.buttonsSection}>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => router.push('/(auth)/signin' as any)}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push('/(auth)/register' as any)}
            >
              <Text style={styles.registerButtonText}>Create Account</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleLogin}
            >
              <Ionicons name="logo-google" size={24} color="#DB4437" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#210059',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  buttonsSection: {
    marginTop: 32,
  },
  signInButton: {
    backgroundColor: '#210059',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  signInButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: '#FFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#210059',
    marginBottom: 24,
  },
  registerButtonText: {
    color: '#210059',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});

