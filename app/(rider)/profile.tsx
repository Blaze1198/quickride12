import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

export default function RiderProfileScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const [riderStatus, setRiderStatus] = useState<string>('offline');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchRiderProfile();
    // Auto-refresh status every 10 seconds
    const interval = setInterval(fetchRiderProfile, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchRiderProfile = async () => {
    try {
      // Fetch rider profile to get current status
      const response = await api.get('/riders/me');
      if (response.data) {
        setRiderStatus(response.data.status);
      }
    } catch (error) {
      console.error('Error fetching rider profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRiderStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      await api.put('/riders/me/status', { status: newStatus });
      setRiderStatus(newStatus);
      
      const statusMessage = 
        newStatus === 'available' ? 'You are now AVAILABLE for deliveries' :
        newStatus === 'busy' ? 'You are now BUSY' :
        'You are now OFFLINE';
      
      if (Platform.OS === 'web') {
        window.alert(statusMessage);
      } else {
        Alert.alert('Status Updated', statusMessage);
      }
    } catch (error) {
      console.error('Error updating rider status:', error);
      
      if (Platform.OS === 'web') {
        window.alert('Failed to update status. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    // Navigate to logout page instead of showing alert
    router.push('/logout');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#4CAF50';
      case 'busy':
        return '#FF9800';
      case 'offline':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return 'checkmark-circle';
      case 'busy':
        return 'time';
      case 'offline':
        return 'moon';
      default:
        return 'help-circle';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return 'Available for Deliveries';
      case 'busy':
        return 'Busy - Currently Delivering';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#210059" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={80} color="#210059" />
          </View>
          <Text style={styles.userName}>{user?.name || 'Rider'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Text style={styles.userRole}>Delivery Rider</Text>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons name="bicycle" size={24} color="#210059" />
            <Text style={styles.statusHeaderText}>Delivery Status</Text>
          </View>

          <View style={[styles.currentStatusBadge, { backgroundColor: getStatusColor(riderStatus) }]}>
            <Ionicons name={getStatusIcon(riderStatus) as any} size={32} color="#FFF" />
            <Text style={styles.currentStatusText}>{getStatusLabel(riderStatus).toUpperCase()}</Text>
          </View>

          <Text style={styles.statusDescription}>
            {riderStatus === 'available' && 'You will receive new delivery assignments'}
            {riderStatus === 'busy' && 'Complete your current delivery to become available'}
            {riderStatus === 'offline' && 'You won\'t receive any delivery assignments'}
          </Text>

          {/* Status Buttons */}
          <View style={styles.statusButtons}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                riderStatus === 'available' && styles.statusButtonActive,
                { borderColor: '#4CAF50' },
              ]}
              onPress={() => updateRiderStatus('available')}
              disabled={updating || riderStatus === 'available'}
            >
              <Ionicons name="checkmark-circle" size={24} color={riderStatus === 'available' ? '#FFF' : '#4CAF50'} />
              <Text style={[
                styles.statusButtonText,
                riderStatus === 'available' && styles.statusButtonTextActive,
                { color: riderStatus === 'available' ? '#FFF' : '#4CAF50' },
              ]}>
                Available
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                riderStatus === 'offline' && styles.statusButtonActive,
                { borderColor: '#9E9E9E' },
              ]}
              onPress={() => updateRiderStatus('offline')}
              disabled={updating || riderStatus === 'offline'}
            >
              <Ionicons name="moon" size={24} color={riderStatus === 'offline' ? '#FFF' : '#9E9E9E'} />
              <Text style={[
                styles.statusButtonText,
                riderStatus === 'offline' && styles.statusButtonTextActive,
                { color: riderStatus === 'offline' ? '#FFF' : '#9E9E9E' },
              ]}>
                Offline
              </Text>
            </TouchableOpacity>
          </View>

          {updating && (
            <ActivityIndicator size="small" color="#210059" style={{ marginTop: 12 }} />
          )}
        </View>

        {/* Menu Options */}
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(rider)/history' as any)}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="time-outline" size={24} color="#666" />
              <Text style={styles.menuItemText}>Delivery History</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#CCC" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={24} color="#F44336" />
              <Text style={[styles.menuItemText, { color: '#F44336' }]}>Logout</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#CCC" />
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <Text style={styles.versionText}>QuickBite Rider v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  userCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  userRole: {
    fontSize: 12,
    color: '#210059',
    backgroundColor: '#FFF8F8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#210059',
  },
  statusCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  currentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  currentStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 12,
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#FFF',
  },
  statusButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusButtonTextActive: {
    color: '#FFF',
  },
  menuCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    marginBottom: 24,
  },
});
