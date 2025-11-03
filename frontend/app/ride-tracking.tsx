import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

interface Ride {
  id: string;
  customer_name: string;
  pickup_location: any;
  dropoff_location: any;
  rider_name?: string;
  rider_phone?: string;
  rider_vehicle?: string;
  distance_km: number;
  actual_fare: number;
  status: string;
  payment_method: string;
  created_at: string;
  pickup_time?: string;
  special_instructions?: string;
}

export default function RideTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const rideId = params.rideId as string;

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (rideId) {
      fetchRide();
      // Auto-refresh every 5 seconds
      const interval = setInterval(fetchRide, 5000);
      return () => clearInterval(interval);
    }
  }, [rideId]);

  const fetchRide = async () => {
    try {
      const response = await api.get(`/rides/${rideId}`);
      setRide(response.data);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching ride:', error);
      setLoading(false);
    }
  };

  const cancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?\n\nCancellation Policy:\n- 1st cancellation: Warning\n- 2nd: ₱5 penalty\n- 3rd: 3-day suspension\n- 4th: 1-week suspension\n- 5th: Indefinite suspension',
      [
        { text: 'No, Keep Ride', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const response = await api.put(`/rides/${rideId}/cancel`, {});
              Alert.alert(
                'Ride Cancelled',
                response.data.cancellation_policy_message,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to cancel ride');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: string }> = {
      pending: { label: 'Finding Rider...', color: '#FF9800', icon: 'search' },
      accepted: { label: 'Rider Assigned', color: '#2196F3', icon: 'checkmark-circle' },
      rider_arrived: { label: 'Rider Arrived', color: '#9C27B0', icon: 'location' },
      picked_up: { label: 'Picked Up', color: '#00BCD4', icon: 'bicycle' },
      in_transit: { label: 'On the Way', color: '#2196F3', icon: 'navigate' },
      completed: { label: 'Completed', color: '#4CAF50', icon: 'checkmark-done' },
      cancelled: { label: 'Cancelled', color: '#F44336', icon: 'close-circle' },
    };
    return statusMap[status] || { label: status, color: '#999', icon: 'help' };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading ride details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#F44336" />
          <Text style={styles.errorText}>Ride not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusInfo(ride.status);
  const canCancel = !['completed', 'cancelled'].includes(ride.status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Ride</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: statusInfo.color + '20' }]}>
          <Ionicons name={statusInfo.icon as any} size={48} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>

        {/* Rider Info */}
        {ride.rider_name && (
          <View style={styles.riderCard}>
            <View style={styles.riderAvatar}>
              <Ionicons name="person" size={32} color="#2196F3" />
            </View>
            <View style={styles.riderInfo}>
              <Text style={styles.riderName}>{ride.rider_name}</Text>
              <Text style={styles.riderVehicle}>{ride.rider_vehicle || 'Motorcycle'}</Text>
            </View>
            {ride.rider_phone && (
              <TouchableOpacity style={styles.callButton}>
                <Ionicons name="call" size={24} color="#4CAF50" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Trip Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Details</Text>
          
          <View style={styles.locationItem}>
            <View style={styles.locationIconContainer}>
              <Ionicons name="location" size={24} color="#4CAF50" />
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationAddress}>{ride.pickup_location.address}</Text>
            </View>
          </View>

          <View style={styles.locationConnector} />

          <View style={styles.locationItem}>
            <View style={styles.locationIconContainer}>
              <Ionicons name="location" size={24} color="#F44336" />
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Dropoff</Text>
              <Text style={styles.locationAddress}>{ride.dropoff_location.address}</Text>
            </View>
          </View>
        </View>

        {/* Fare Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fare Details</Text>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Distance</Text>
            <Text style={styles.fareValue}>{ride.distance_km} km</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Payment Method</Text>
            <Text style={styles.fareValue}>
              {ride.payment_method === 'cash' ? 'Cash' : 'GCash'}
            </Text>
          </View>
          <View style={styles.fareDivider} />
          <View style={styles.fareRow}>
            <Text style={styles.fareTotalLabel}>Total Fare</Text>
            <Text style={styles.fareTotalValue}>₱{ride.actual_fare.toFixed(2)}</Text>
          </View>
        </View>

        {/* Special Instructions */}
        {ride.special_instructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <Text style={styles.instructionsText}>{ride.special_instructions}</Text>
          </View>
        )}

        {/* Cancel Button */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelRide}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#F44336" />
            ) : (
              <>
                <Ionicons name="close-circle" size={20} color="#F44336" />
                <Text style={styles.cancelButtonText}>Cancel Ride</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Completed Actions */}
        {ride.status === 'completed' && (
          <View style={styles.completedActions}>
            <TouchableOpacity style={styles.rateButton}>
              <Ionicons name="star" size={20} color="#FF9800" />
              <Text style={styles.rateButtonText}>Rate Rider</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bookAgainButton}
              onPress={() => router.replace('/ride-booking')}
            >
              <Text style={styles.bookAgainButtonText}>Book Again</Text>
            </TouchableOpacity>
          </View>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#F44336',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  statusCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    gap: 16,
  },
  riderAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  riderVehicle: {
    fontSize: 14,
    color: '#666',
  },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  locationDetails: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  locationConnector: {
    width: 2,
    height: 24,
    backgroundColor: '#E0E0E0',
    marginLeft: 19,
    marginVertical: 8,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  fareLabel: {
    fontSize: 14,
    color: '#666',
  },
  fareValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  fareDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  fareTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  fareTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F44336',
    gap: 8,
    marginBottom: 20,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  completedActions: {
    gap: 12,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  bookAgainButton: {
    padding: 16,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    alignItems: 'center',
  },
  bookAgainButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
});
