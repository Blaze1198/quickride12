import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

interface Order {
  id: string;
  restaurant_name: string;
  customer_name: string;
  customer_phone: string;
  total_amount: float;
  status: string;
  delivery_address: {
    address: string;
  };
  created_at: string;
}

import { useAuthStore } from '../../store/authStore';

function RiderActiveContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      // Fetch rider's active deliveries (assigned and in progress)
      const currentOrder = await api.get('/rider/current-order');
      const currentRide = await api.get('/rider/current-ride');
      
      const activeOrders = [];
      if (currentOrder.data) {
        activeOrders.push(currentOrder.data);
      }
      if (currentRide.data) {
        activeOrders.push(currentRide.data);
      }
      
      setOrders(activeOrders);
    } catch (error: any) {
      // Silently fail if unauthorized
      if (error?.response?.status !== 401) {
        console.error('Error fetching active orders:', error);
      }
      setOrders([]);
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
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Mark this order as picked up?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Pickup Order',
            'Confirm you have picked up this order?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Confirm', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      await api.put(`/orders/${orderId}/status`, { status: 'picked_up' });
      
      if (Platform.OS === 'web') {
        window.alert('Order marked as picked up!');
      } else {
        Alert.alert('Success', 'Order marked as picked up!');
      }
      
      fetchOrders();
    } catch (error: any) {
      console.error('Error updating status:', error);
      
      const message = error.response?.data?.detail || 'Failed to update status.';
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleCompleteDelivery = async (orderId: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Mark this delivery as complete?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Complete Delivery',
            'Mark this order as delivered?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Complete', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      await api.put(`/orders/${orderId}/status`, { status: 'delivered' });
      
      if (Platform.OS === 'web') {
        window.alert('Delivery completed! 🎉');
      } else {
        Alert.alert('Success', 'Delivery completed! 🎉');
      }
      
      fetchOrders();
    } catch (error: any) {
      console.error('Error completing delivery:', error);
      
      const message = error.response?.data?.detail || 'Failed to complete delivery.';
      
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
        <View>
          <Text style={styles.restaurantName}>{item.restaurant_name}</Text>
          <Text style={styles.customerName}>To: {item.customer_name}</Text>
        </View>
        <Text style={styles.amount}>₱{item.total_amount.toFixed(2)}</Text>
      </View>

      <View style={styles.addressSection}>
        <Ionicons name="location" size={20} color="#210059" />
        <Text style={styles.address} numberOfLines={2}>
          {item.delivery_address.address}
        </Text>
      </View>

      <View style={styles.contactSection}>
        <TouchableOpacity style={styles.contactButton}>
          <Ionicons name="call" size={20} color="#4CAF50" />
          <Text style={styles.contactText}>{item.customer_phone}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {item.status === 'out_for_delivery' ? '🚴 ON THE WAY' : 
           item.status === 'picked_up' ? '📦 PICKED UP' :
           item.status === 'ready_for_pickup' ? '🏪 READY FOR PICKUP' :
           '📦 AT RESTAURANT'}
        </Text>
      </View>

      {item.status === 'ready_for_pickup' && (
        <TouchableOpacity
          style={styles.pickupButton}
          onPress={() => handlePickup(item.id)}
        >
          <Ionicons name="checkmark-circle" size={24} color="#FFF" />
          <Text style={styles.pickupButtonText}>Mark as Picked Up</Text>
        </TouchableOpacity>
      )}

      {item.status === 'picked_up' && (
        <TouchableOpacity
          style={styles.startDeliveryButton}
          onPress={() => handleCompleteDelivery(item.id)}
        >
          <Ionicons name="navigate-circle" size={24} color="#FFF" />
          <Text style={styles.startDeliveryButtonText}>Start Delivery</Text>
        </TouchableOpacity>
      )}

      {item.status === 'out_for_delivery' && (
        <TouchableOpacity
          style={styles.completeButton}
          onPress={() => handleCompleteDelivery(item.id)}
        >
          <Ionicons name="checkmark-done-circle" size={24} color="#FFF" />
          <Text style={styles.completeButtonText}>Complete Delivery</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#210059" />
        </View>
      </SafeAreaView>
    );
  }

  const activeOrders = orders.filter(
    (o) => o.status === 'ready_for_pickup' || 
           o.status === 'rider_assigned' || 
           o.status === 'picked_up' || 
           o.status === 'out_for_delivery'
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={activeOrders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#210059']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bicycle-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No active deliveries</Text>
            <Text style={styles.emptySubtext}>
              Check the Available tab for new orders
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// Wrapper component to prevent hooks violation
export default function RiderActiveScreen() {
  const { user, isLoading: authLoading } = useAuthStore();

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#210059" />
        </View>
      </SafeAreaView>
    );
  }

  if (user && user.role !== 'rider') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed" size={80} color="#210059" />
          <Text style={styles.emptyText}>Access Restricted</Text>
          <Text style={styles.emptySubtext}>This screen is only accessible to riders</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <RiderActiveContent />;
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
    marginBottom: 12,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#210059',
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF8F8',
    borderRadius: 12,
    marginBottom: 12,
  },
  address: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  contactSection: {
    marginBottom: 12,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
  },
  contactText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  statusBadge: {
    padding: 12,
    backgroundColor: '#210059',
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  completeButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  pickupButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  pickupButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  startDeliveryButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  startDeliveryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: '#999',
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
  },
});