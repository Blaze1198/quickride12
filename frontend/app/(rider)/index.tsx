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

export default function RiderAvailableScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchOrders();
    // Poll for new orders
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      // Get rider's assigned orders
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handlePickup = async (orderId: string) => {
    console.log('Mark pickup clicked for order:', orderId);
    
    // Cross-platform confirmation
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('Mark this order as picked up?')
      : await new Promise((resolve) => {
          Alert.alert('Pickup Confirmation', 'Mark this order as picked up?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Confirm', onPress: () => resolve(true) },
          ]);
        });

    if (!confirmed) {
      console.log('Pickup cancelled');
      return;
    }

    console.log('Processing pickup...');
    try {
      await api.put(`/orders/${orderId}/status`, { status: 'picked_up' });
      console.log('Order marked as picked up');
      
      if (Platform.OS === 'web') {
        window.alert('Order picked up! Now delivering to customer.');
      } else {
        Alert.alert('Success', 'Order picked up! Now delivering to customer.');
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
           item.status === 'picked_up' ? 'PICKED UP - On the Way' :
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

      {item.status === 'picked_up' && (
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
      <FlatList
        data={orders.filter((o) => o.status === 'rider_assigned' || o.status === 'picked_up')}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B6B']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bicycle-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No available deliveries</Text>
          </View>
        }
      />
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
