import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

interface Order {
  id: string;
  restaurant_name: string;
  customer_name: string;
  total_amount: number;
  status: string;
  delivery_address: {
    address: string;
    latitude: number;
    longitude: number;
  };
  created_at: string;
}

interface Ride {
  id: string;
  customer_name: string;
  pickup_location: any;
  dropoff_location: any;
  distance_km: number;
  estimated_fare: number;
  status: string;
  created_at: string;
}

export default function RiderAvailableScreen() {
  const [serviceType, setServiceType] = useState<'food_delivery' | 'ride_service'>('food_delivery');
  const [orders, setOrders] = useState<Order[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetchData();
    // Poll for new orders/rides
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [serviceType]);

  const fetchData = async () => {
    try {
      if (serviceType === 'food_delivery') {
        const response = await api.get('/orders');
        setOrders(response.data);
      } else {
        const response = await api.get('/rider/rides/available');
        setRides(response.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleService = async () => {
    const newService = serviceType === 'food_delivery' ? 'ride_service' : 'food_delivery';
    
    setToggling(true);
    try {
      await api.put('/rider/toggle-service', { service_type: newService });
      setServiceType(newService);
      setLoading(true);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to switch service');
    } finally {
      setToggling(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const acceptRide = async (rideId: string) => {
    try {
      await api.put(`/rider/rides/${rideId}/accept`, {});
      Alert.alert('Success', 'Ride accepted! Navigate to pickup location.');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to accept ride');
    }
  };

  const handlePickup = async (orderId: string) => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('Mark this order as picked up?')
      : await new Promise((resolve) => {
          Alert.alert('Pickup Confirmation', 'Mark this order as picked up?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Confirm', onPress: () => resolve(true) },
          ]);
        });

    if (!confirmed) return;
    try {
      await api.put(`/orders/${orderId}/status`, { status: 'out_for_delivery' });
      console.log('Order marked as out for delivery');
      
      if (Platform.OS === 'web') {
        window.alert('Order picked up! Now out for delivery.');
      } else {
        Alert.alert('Success', 'Order picked up! Now out for delivery.');
      }
      
      fetchOrders();
    } catch (error: any) {
      console.error('Error marking pickup:', error);
      console.error('Error response:', error.response?.data);
      
      const message = error.response?.data?.detail || 'Failed to mark as picked up. Please try again.';
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleDeliver = async (orderId: string) => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('Mark this order as delivered?')
      : await new Promise((resolve) => {
          Alert.alert('Delivery Confirmation', 'Mark this order as delivered?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Confirm', onPress: () => resolve(true) },
          ]);
        });

    if (!confirmed) return;

    try {
      await api.put(`/orders/${orderId}/status`, { status: 'delivered' });
      
      if (Platform.OS === 'web') {
        window.alert('Order delivered successfully!');
      } else {
        Alert.alert('Success', 'Order delivered successfully!');
      }
      
      fetchOrders();
    } catch (error: any) {
      console.error('Error marking delivery:', error);
      
      const message = error.response?.data?.detail || 'Failed to mark as delivered.';
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const renderRide = ({ item }: { item: Ride }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.restaurantInfo}>
          <Ionicons name="bicycle" size={24} color="#2196F3" />
          <View style={styles.restaurantDetails}>
            <Text style={styles.restaurantName}>Ride Request</Text>
            <Text style={styles.customerName}>{item.customer_name}</Text>
          </View>
        </View>
        <Text style={styles.amount}>₱{item.estimated_fare.toFixed(2)}</Text>
      </View>

      <View style={styles.addressContainer}>
        <Ionicons name="location" size={20} color="#4CAF50" />
        <Text style={styles.address} numberOfLines={1}>
          From: {item.pickup_location.address}
        </Text>
      </View>
      
      <View style={styles.addressContainer}>
        <Ionicons name="location" size={20} color="#F44336" />
        <Text style={styles.address} numberOfLines={1}>
          To: {item.dropoff_location.address}
        </Text>
      </View>

      <View style={styles.rideInfo}>
        <Text style={styles.rideDistance}>{item.distance_km} km</Text>
      </View>

      <TouchableOpacity
        style={styles.acceptRideButton}
        onPress={() => acceptRide(item.id)}
      >
        <Ionicons name="checkmark-circle" size={24} color="#FFF" />
        <Text style={styles.acceptRideButtonText}>Accept Ride</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.restaurantInfo}>
          <Ionicons name="restaurant" size={24} color="#FF6B6B" />
          <View style={styles.restaurantDetails}>
            <Text style={styles.restaurantName}>{item.restaurant_name}</Text>
            <Text style={styles.customerName}>Deliver to: {item.customer_name}</Text>
          </View>
        </View>
        <Text style={styles.amount}>₱{item.total_amount.toFixed(2)}</Text>
      </View>

      <View style={styles.addressContainer}>
        <Ionicons name="location" size={20} color="#666" />
        <Text style={styles.address} numberOfLines={2}>
          {item.delivery_address.address}
        </Text>
      </View>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {item.status === 'rider_assigned' ? 'ASSIGNED - Ready for Pickup' :
           item.status === 'out_for_delivery' ? 'OUT FOR DELIVERY 🚴' :
           item.status}
        </Text>
      </View>

      {item.status === 'rider_assigned' && (
        <TouchableOpacity
          style={styles.pickupButton}
          onPress={() => handlePickup(item.id)}
        >
          <Ionicons name="cube" size={24} color="#FFF" />
          <Text style={styles.pickupButtonText}>Mark as Picked Up</Text>
        </TouchableOpacity>
      )}

      {item.status === 'out_for_delivery' && (
        <TouchableOpacity
          style={styles.deliverButton}
          onPress={() => handleDeliver(item.id)}
        >
          <Ionicons name="checkmark-done-circle" size={24} color="#FFF" />
          <Text style={styles.deliverButtonText}>Mark as Delivered</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B6B" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Service Toggle Header */}
      <View style={styles.toggleHeader}>
        <View style={styles.toggleContainer}>
          <View style={styles.toggleOption}>
            <Ionicons 
              name="fast-food" 
              size={24} 
              color={serviceType === 'food_delivery' ? '#FF6B6B' : '#999'} 
            />
            <Text style={[
              styles.toggleText,
              serviceType === 'food_delivery' && styles.toggleTextActive
            ]}>
              Food Delivery
            </Text>
          </View>
          
          <Switch
            value={serviceType === 'ride_service'}
            onValueChange={toggleService}
            disabled={toggling}
            trackColor={{ false: '#FFE8E8', true: '#E3F2FD' }}
            thumbColor={serviceType === 'ride_service' ? '#2196F3' : '#FF6B6B'}
          />
          
          <View style={styles.toggleOption}>
            <Ionicons 
              name="bicycle" 
              size={24} 
              color={serviceType === 'ride_service' ? '#2196F3' : '#999'} 
            />
            <Text style={[
              styles.toggleText,
              serviceType === 'ride_service' && styles.toggleTextActive
            ]}>
              Ride Service
            </Text>
          </View>
        </View>
      </View>

      {/* List */}
      {serviceType === 'food_delivery' ? (
        <FlatList
          data={orders.filter((o) => o.status === 'rider_assigned' || o.status === 'out_for_delivery')}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B6B']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>No available food deliveries</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={rides}
          renderItem={renderRide}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196F3']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bicycle-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>No available ride requests</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  toggleHeader: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#333',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  restaurantInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  restaurantDetails: {
    marginLeft: 12,
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: '#666',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 16,
  },
  address: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#F0F0F0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  pickupButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deliverButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  acceptButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
});
