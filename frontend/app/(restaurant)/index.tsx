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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  items: any[];
  total_amount: number;
  status: string;
  created_at: string;
  delivery_address: {
    address: string;
  };
}

export default function RestaurantOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchOrders();
    // Poll for new orders every 10 seconds
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
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

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const handleAcceptOrder = (orderId: string) => {
    Alert.alert('Accept Order', 'Accept this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: () => updateOrderStatus(orderId, 'accepted'),
      },
    ]);
  };

  const handleRejectOrder = (orderId: string) => {
    Alert.alert('Reject Order', 'Reject this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => updateOrderStatus(orderId, 'cancelled'),
      },
    ]);
  };

  const getNextStatus = (currentStatus: string) => {
    const statusFlow: Record<string, string> = {
      preparing: 'ready_for_pickup',
    };
    return statusFlow[currentStatus];
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      preparing: 'Mark Ready for Pickup',
    };
    return statusMap[status] || 'Update Status';
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.customerName}>{item.customer_name}</Text>
          <Text style={styles.orderTime}>
            {new Date(item.created_at).toLocaleTimeString()}
          </Text>
        </View>
        <Text style={styles.orderTotal}>₱{item.total_amount.toFixed(2)}</Text>
      </View>

      <View style={styles.orderItems}>
        {item.items.map((orderItem, index) => (
          <Text key={index} style={styles.orderItem}>
            {orderItem.quantity}x {orderItem.name}
          </Text>
        ))}
      </View>

      <View style={styles.deliveryInfo}>
        <Ionicons name="location" size={16} color="#666" />
        <Text style={styles.deliveryAddress} numberOfLines={1}>
          {item.delivery_address.address}
        </Text>
      </View>

      <View style={styles.orderActions}>
        {item.status === 'preparing' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => updateOrderStatus(item.id, getNextStatus(item.status))}
          >
            <Text style={styles.primaryButtonText}>
              {getStatusText(item.status)}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
        data={orders.filter((o) => !['delivered', 'cancelled', 'picked_up', 'out_for_delivery'].includes(o.status))}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B6B']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No active orders</Text>
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
    marginBottom: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  orderItems: {
    marginBottom: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
  },
  orderItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  deliveryAddress: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#F44336',
  },
  primaryButton: {
    backgroundColor: '#FF6B6B',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
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
