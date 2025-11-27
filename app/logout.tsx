import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';

export default function LogoutScreen() {
  const router = useRouter();
  const { logout: authLogout, user } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Call backend logout endpoint
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear auth state and redirect to login
      authLogout();
      router.replace('/(auth)/login');
    }
  };

  const handleCancel = () => {
    // Go back to previous screen
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="log-out-outline" size={80} color="#210059" />
        </View>

        <Text style={styles.title}>Logout</Text>
        <Text style={styles.subtitle}>
          Are you sure you want to logout from your account?
        </Text>

        {user && (
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name || user.email}</Text>
            <Text style={styles.userRole}>
              {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)} Account
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            disabled={isLoggingOut}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleConfirmLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.logoutButtonText}>Logout</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          You can always log back in anytime with your credentials.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  userInfo: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 400,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  cancelButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#DDD',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#210059',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  note: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
});
