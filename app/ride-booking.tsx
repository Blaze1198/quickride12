import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

interface Stop {
  location: Location;
  order: number;
  completed: boolean;
}

export default function RideBookingScreen() {
  const router = useRouter();
  const [pickup, setPickup] = useState<Location | null>(null);
  const [dropoff, setDropoff] = useState<Location | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [fareEstimate, setFareEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Mock location selection (in real app, this would use Google Maps picker)
  const selectLocation = (type: 'pickup' | 'dropoff') => {
    // Using mock Manila locations for demo
    const mockLocations = [
      { latitude: 14.5995, longitude: 120.9842, address: 'Intramuros, Manila' },
      { latitude: 14.6042, longitude: 120.9822, address: 'Ermita, Manila' },
      { latitude: 14.5547, longitude: 120.9934, address: 'Makati, Metro Manila' },
      { latitude: 14.6091, longitude: 121.0223, address: 'Quezon City' },
      { latitude: 14.5764, longitude: 121.0851, address: 'Pasig City' },
    ];

    const location = mockLocations[Math.floor(Math.random() * mockLocations.length)];

    if (type === 'pickup') {
      setPickup(location);
      setPickupAddress(location.address);
    } else {
      setDropoff(location);
      setDropoffAddress(location.address);
    }
  };

  const calculateFare = async () => {
    if (!pickup || !dropoff) {
      Alert.alert('Error', 'Please select pickup and dropoff locations');
      return;
    }

    setCalculating(true);
    try {
      const response = await api.post('/rides/calculate-fare', {
        pickup_location: pickup,
        dropoff_location: dropoff,
        stops: stops,
      });
      setFareEstimate(response.data);
    } catch (error: any) {
      console.error('Fare calculation error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to calculate fare');
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (pickup && dropoff) {
      calculateFare();
    }
  }, [pickup, dropoff, stops]);

  const addStop = () => {
    Alert.alert(
      'Add Stop',
      'This feature allows you to add multiple destinations',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: () => {
            // Mock stop location
            const mockStop: Stop = {
              location: {
                latitude: 14.5547,
                longitude: 120.9934,
                address: 'Additional Stop',
              },
              order: stops.length + 1,
              completed: false,
            };
            setStops([...stops, mockStop]);
          },
        },
      ]
    );
  };

  const removeStop = (index: number) => {
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops);
  };

  const bookRide = async () => {
    if (!pickup || !dropoff) {
      Alert.alert('Error', 'Please select pickup and dropoff locations');
      return;
    }

    setLoading(true);
    try {
      const rideData = {
        pickup_location: pickup,
        dropoff_location: dropoff,
        stops: stops,
        payment_method: paymentMethod,
        special_instructions: specialInstructions || undefined,
        scheduled_time: scheduledTime?.toISOString() || undefined,
      };

      const response = await api.post('/rides', rideData);
      
      Alert.alert(
        'Ride Booked!',
        `Your ride has been ${scheduledTime ? 'scheduled' : 'requested'}. Finding a nearby rider...`,
        [
          {
            text: 'View Ride',
            onPress: () => router.push(`/ride-tracking?rideId=${response.data.id}`),
          },
        ]
      );
    } catch (error: any) {
      console.error('Booking error:', error);
      const message = error.response?.data?.detail || 'Failed to book ride';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book a Ride</Text>
        <TouchableOpacity onPress={() => router.push('/service-selection')}>
          <Ionicons name="swap-horizontal" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Pickup Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Location</Text>
          <TouchableOpacity
            style={styles.locationInput}
            onPress={() => selectLocation('pickup')}
          >
            <Ionicons name="location" size={24} color="#4CAF50" />
            <Text style={pickup ? styles.locationText : styles.placeholderText}>
              {pickupAddress || 'Select pickup location'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Dropoff Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dropoff Location</Text>
          <TouchableOpacity
            style={styles.locationInput}
            onPress={() => selectLocation('dropoff')}
          >
            <Ionicons name="location" size={24} color="#F44336" />
            <Text style={dropoff ? styles.locationText : styles.placeholderText}>
              {dropoffAddress || 'Select dropoff location'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Additional Stops */}
        {stops.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Stops</Text>
            {stops.map((stop, index) => (
              <View key={index} style={styles.stopItem}>
                <Ionicons name="flag" size={20} color="#FF9800" />
                <Text style={styles.stopText}>Stop {index + 1}: {stop.location.address}</Text>
                <TouchableOpacity onPress={() => removeStop(index)}>
                  <Ionicons name="close-circle" size={24} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.addStopButton} onPress={addStop}>
          <Ionicons name="add-circle-outline" size={20} color="#2196F3" />
          <Text style={styles.addStopText}>Add Stop</Text>
        </TouchableOpacity>

        {/* Fare Estimate */}
        {calculating ? (
          <View style={styles.fareCard}>
            <ActivityIndicator size="small" color="#2196F3" />
            <Text style={styles.calculatingText}>Calculating fare...</Text>
          </View>
        ) : fareEstimate ? (
          <View style={styles.fareCard}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Distance</Text>
              <Text style={styles.fareValue}>{fareEstimate.distance_km} km</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Base Fare</Text>
              <Text style={styles.fareValue}>₱{fareEstimate.base_fare.toFixed(2)}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Distance Charge</Text>
              <Text style={styles.fareValue}>
                ₱{((fareEstimate.estimated_fare - fareEstimate.base_fare).toFixed(2))}
              </Text>
            </View>
            {fareEstimate.cancellation_fee > 0 && (
              <View style={styles.fareRow}>
                <Text style={[styles.fareLabel, { color: '#F44336' }]}>Cancellation Fee</Text>
                <Text style={[styles.fareValue, { color: '#F44336' }]}>
                  ₱{fareEstimate.cancellation_fee.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.fareDivider} />
            <View style={styles.fareRow}>
              <Text style={styles.fareTotalLabel}>Total Fare</Text>
              <Text style={styles.fareTotalValue}>₱{fareEstimate.total_fare.toFixed(2)}</Text>
            </View>
          </View>
        ) : null}

        {/* Special Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Wait at the main entrance"
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity
            style={styles.paymentButton}
            onPress={() => setShowPaymentModal(true)}
          >
            <Ionicons
              name={paymentMethod === 'cash' ? 'cash' : 'card'}
              size={24}
              color="#2196F3"
            />
            <Text style={styles.paymentText}>
              {paymentMethod === 'cash' ? 'Cash' : 'GCash'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Schedule Option */}
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => setShowScheduleModal(true)}
        >
          <Ionicons name="time-outline" size={20} color="#2196F3" />
          <Text style={styles.scheduleText}>
            {scheduledTime
              ? `Scheduled for ${scheduledTime.toLocaleString()}`
              : 'Schedule for later'}
          </Text>
        </TouchableOpacity>

        {/* Book Button */}
        <TouchableOpacity
          style={[styles.bookButton, (!pickup || !dropoff || loading) && styles.bookButtonDisabled]}
          onPress={bookRide}
          disabled={!pickup || !dropoff || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.bookButtonText}>
                {scheduledTime ? 'Schedule Ride' : 'Book Now'}
              </Text>
              {fareEstimate && (
                <Text style={styles.bookButtonPrice}>₱{fareEstimate.total_fare.toFixed(2)}</Text>
              )}
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Payment Method</Text>
            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => {
                setPaymentMethod('cash');
                setShowPaymentModal(false);
              }}
            >
              <Ionicons name="cash" size={32} color="#4CAF50" />
              <Text style={styles.paymentOptionText}>Cash</Text>
              {paymentMethod === 'cash' && (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => {
                setPaymentMethod('gcash');
                setShowPaymentModal(false);
              }}
            >
              <Ionicons name="card" size={32} color="#2196F3" />
              <Text style={styles.paymentOptionText}>GCash</Text>
              {paymentMethod === 'gcash' && (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowPaymentModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Schedule Ride</Text>
            <Text style={styles.modalSubtitle}>Choose when you need the ride</Text>
            
            {/* Quick Schedule Options */}
            <TouchableOpacity
              style={styles.scheduleOption}
              onPress={() => {
                const now = new Date();
                now.setHours(now.getHours() + 1);
                setScheduledTime(now);
                setShowScheduleModal(false);
              }}
            >
              <Text style={styles.scheduleOptionText}>In 1 Hour</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.scheduleOption}
              onPress={() => {
                const now = new Date();
                now.setHours(now.getHours() + 2);
                setScheduledTime(now);
                setShowScheduleModal(false);
              }}
            >
              <Text style={styles.scheduleOptionText}>In 2 Hours</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.scheduleOption}
              onPress={() => {
                setScheduledTime(null);
                setShowScheduleModal(false);
              }}
            >
              <Text style={styles.scheduleOptionText}>Book Now (No Schedule)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowScheduleModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    flex: 1,
    fontSize: 16,
    color: '#999',
  },
  addStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    gap: 8,
    marginBottom: 20,
  },
  addStopText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    gap: 12,
    marginBottom: 8,
  },
  stopText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  fareCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  calculatingText: {
    marginLeft: 12,
    color: '#666',
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
  textInput: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    textAlignVertical: 'top',
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  paymentText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  scheduleText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  bookButton: {
    backgroundColor: '#2196F3',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  bookButtonDisabled: {
    backgroundColor: '#CCC',
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  bookButtonPrice: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    gap: 16,
    marginBottom: 12,
  },
  paymentOptionText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scheduleOption: {
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 12,
  },
  scheduleOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  modalCloseButton: {
    padding: 16,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#666',
  },
});
