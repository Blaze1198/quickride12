import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import api, { setAuthToken } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout: authLogout } = useAuthStore();
  const { clearCart } = useCartStore();

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, [{ text: 'OK' }]);
    }
  };

  const handleEditProfile = () => {
    router.push('/edit-profile' as any);
  };

  const handleSavedAddresses = () => {
    showAlert(
      'Saved Addresses',
      'Manage your delivery addresses for faster checkout.'
    );
  };

  const handlePaymentMethods = () => {
    showAlert(
      'Payment Methods',
      'Add and manage your payment methods including GCash, Credit Cards, and Cash on Delivery.'
    );
  };

  const handleNotifications = () => {
    showAlert(
      'Notifications',
      'Manage your notification preferences for orders, promotions, and updates.'
    );
  };

  const handleHelpSupport = () => {
    showAlert(
      'Help & Support',
      'Contact us:\n\nEmail: support@quickbite.ph\nPhone: +63 917 123 4567\n\nOperating Hours:\n9:00 AM - 9:00 PM (Mon-Sun)'
    );
  };

  const handleAbout = () => {
    showAlert(
      'About QuickBite',
      'Version 1.0.0\n\nQuickBite is your favorite food delivery platform in the Philippines. Order from the best restaurants and get your food delivered fast!\n\n© 2025 QuickBite Philippines'
    );
  };

  const handleLogout = () => {
    // Navigate to logout page instead of showing alert
    router.push('/logout');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={48} color="#FFF" />
            </View>
          )}
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user?.role?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
            <Ionicons name="person-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleSavedAddresses}>
            <Ionicons name="location-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Saved Addresses</Text>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handlePaymentMethods}>
            <Ionicons name="card-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Payment Methods</Text>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleNotifications}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleHelpSupport}>
            <Ionicons name="help-circle-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleAbout}>
            <Ionicons name="information-circle-outline" size={24} color="#333" />
            <Text style={styles.menuItemText}>About</Text>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
  },
  roleBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginTop: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
    marginLeft: 8,
  },
});
