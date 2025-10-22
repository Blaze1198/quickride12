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
const REDIRECT_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://quickbite-ph.preview.emergentagent.com';

export default function LoginScreen() {
  const router = useRouter();
  const { setUser, setSessionToken, setLoading } = useAuthStore();
  const [processing, setProcessing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'customer' | 'restaurant' | 'rider'>('customer');

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
        role: selectedRole,
      });

      const { user, session_token } = response.data;

      setUser(user);
      setSessionToken(session_token);
      setAuthToken(session_token);

      // Navigate based on role
      if (user.role === 'customer') {
        router.replace('/(customer)');
      } else if (user.role === 'restaurant') {
        router.replace('/(restaurant)');
      } else if (user.role === 'rider') {
        router.replace('/(rider)');
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
          <ActivityIndicator size="large" color="#FF6B6B" />
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
            <Ionicons name="fast-food" size={80} color="#FF6B6B" />
            <Text style={styles.title}>QuickBite</Text>
            <Text style={styles.subtitle}>Food Delivery at Your Fingertips</Text>
          </View>

          <View style={styles.roleSection}>
            <Text style={styles.roleTitle}>I am a:</Text>
            
            <TouchableOpacity
              style={[
                styles.roleCard,
                selectedRole === 'customer' && styles.roleCardSelected,
              ]}
              onPress={() => setSelectedRole('customer')}
            >
              <Ionicons
                name="person"
                size={40}
                color={selectedRole === 'customer' ? '#FF6B6B' : '#666'}
              />
              <Text
                style={[
                  styles.roleCardTitle,
                  selectedRole === 'customer' && styles.roleCardTitleSelected,
                ]}
              >
                Customer
              </Text>
              <Text style={styles.roleCardSubtitle}>Order delicious food</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleCard,
                selectedRole === 'restaurant' && styles.roleCardSelected,
              ]}
              onPress={() => setSelectedRole('restaurant')}
            >
              <Ionicons
                name="restaurant"
                size={40}
                color={selectedRole === 'restaurant' ? '#FF6B6B' : '#666'}
              />
              <Text
                style={[
                  styles.roleCardTitle,
                  selectedRole === 'restaurant' && styles.roleCardTitleSelected,
                ]}
              >
                Restaurant
              </Text>
              <Text style={styles.roleCardSubtitle}>Manage your restaurant</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleCard,
                selectedRole === 'rider' && styles.roleCardSelected,
              ]}
              onPress={() => setSelectedRole('rider')}
            >
              <Ionicons
                name="bicycle"
                size={40}
                color={selectedRole === 'rider' ? '#FF6B6B' : '#666'}
              />
              <Text
                style={[
                  styles.roleCardTitle,
                  selectedRole === 'rider' && styles.roleCardTitleSelected,
                ]}
              >
                Rider
              </Text>
              <Text style={styles.roleCardSubtitle}>Deliver orders & earn</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Ionicons name="logo-google" size={24} color="#FFF" />
            <Text style={styles.loginButtonText}>Sign in with Google</Text>
          </TouchableOpacity>
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
    color: '#FF6B6B',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  roleSection: {
    marginBottom: 32,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginBottom: 12,
    backgroundColor: '#FFF',
  },
  roleCardSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  roleCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 16,
    flex: 1,
  },
  roleCardTitleSelected: {
    color: '#FF6B6B',
  },
  roleCardSubtitle: {
    fontSize: 12,
    color: '#999',
    position: 'absolute',
    bottom: 8,
    left: 76,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    padding: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
});
