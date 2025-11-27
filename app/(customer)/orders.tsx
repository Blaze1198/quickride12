import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Order {
  id: string;
  restaurant_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: any[];
  rider_name?: string;
  rider_phone?: string;
}

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 5 seconds for real-time updates
    const interval = setInterval(fetchOrders, 5000);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      case 'pending':
      case 'payment_pending':
      case 'paid':
        return '#FFC107';
      case 'preparing':
        return '#FF9800';
      case 'ready_for_pickup':
        return '#9C27B0';
      case 'rider_assigned':
        return '#673AB7';
      case 'out_for_delivery':
        return '#2196F3';
      default:
        return '#607D8B';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'checkmark-circle';
      case 'cancelled':
        return 'close-circle';
      case 'pending':
      case 'paid':
      case 'payment_pending':
        return 'time';
      case 'preparing':
        return 'restaurant';
      case 'ready_for_pickup':
        return 'cube';
      case 'rider_assigned':
        return 'person';
      case 'out_for_delivery':
        return 'bicycle';
      default:
        return 'information-circle';
    }
  };

  const formatStatus = (status: string, order: Order) => {
    // Show "Ready for Pickup" when rider is assigned
    if (status === 'rider_assigned' && order.rider_name) {
      return 'Ready for Pickup';
    }
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const canTrack = ['rider_assigned', 'picked_up', 'out_for_delivery'].includes(item.status);
    
    return (
      <View style={styles.orderCard}>
        <TouchableOpacity
          style={styles.orderMainContent}
          onPress={() => router.push(`/order/${item.id}` as any)}
        >
          <View style={styles.orderHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.restaurantName}>{item.restaurant_name}</Text>
              <Text style={styles.orderDate}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Ionicons name={getStatusIcon(item.status) as any} size={16} color="#FFF" />
              <Text style={styles.statusText}>{formatStatus(item.status, item)}</Text>
            </View>
          </View>
          
          {/* Show rider info for rider_assigned status */}
          {item.status === 'rider_assigned' && item.rider_name && (
            <View style={styles.riderInfoBanner}>
              <Ionicons name="bicycle" size={18} color="#4CAF50" />
              <View style={styles.riderDetails}>
                <Text style={styles.riderLabel}>Rider:</Text>
                <Text style={styles.riderName}>{item.rider_name}</Text>
                {item.rider_phone && (
                  <Text style={styles.riderPhone}>• {item.rider_phone}</Text>
                )}
              </View>
            </View>
          )}
          
          <View style={styles.orderBody}>
            <Text style={styles.itemsText}>
              {item.items?.length || 0} item{(item.items?.length || 0) !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.totalAmount}>₱{(item.total_amount || 0).toFixed(2)}</Text>
          </View>
        </TouchableOpacity>
        
        {/* Track Live Button */}
        {canTrack && (
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => router.push(`/live-order-tracking?orderId=${item.id}` as any)}
          >
            <Ionicons name="navigate" size={20} color="#FFF" />
            <Text style={styles.trackButtonText}>Track Live</Text>
          </TouchableOpacity>
        )}
      </View>
    );
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

  // Filter out delivered and cancelled orders - those go to History
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Active Orders</Text>
        <TouchableOpacity 
          style={styles.historyButton}
          onPress={() => router.push('/(customer)/history' as any)}
        >
          <Ionicons name="time-outline" size={20} color="#210059" />
          <Text style={styles.historyButtonText}>History</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeOrders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#210059']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No orders yet</Text>
            <Text style={styles.emptySubtext}>Start ordering delicious food!</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#210059',
  },
  historyButtonText: {
    color: '#210059',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  orderMainContent: {
    padding: 16,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#210059',
    padding: 14,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    gap: 8,
  },
  trackButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
  },
  riderInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  riderDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  riderLabel: {
    fontSize: 13,
    color: '#666',
    marginRight: 4,
  },
  riderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 4,
  },
  riderPhone: {
    fontSize: 13,
    color: '#66BB6A',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  orderBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemsText: {
    fontSize: 14,
    color: '#666',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#210059',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
});
