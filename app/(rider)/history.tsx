import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

interface Order {
  id: string;
  restaurant_name: string;
  total_amount: number;
  rider_fee: number;
  status: string;
  created_at: string;
  customer_name: string;
}

export default function RiderHistoryScreen() {
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

  const completedOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');
  const totalEarnings = deliveredOrders.reduce((sum, o) => sum + (o.rider_fee || 0), 0);
  const todayEarnings = deliveredOrders
    .filter((o) => {
      const orderDate = new Date(o.created_at);
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    })
    .reduce((sum, o) => sum + (o.rider_fee || 0), 0);

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.restaurantName}>{item.restaurant_name}</Text>
          <Text style={styles.customerName}>Customer: {item.customer_name}</Text>
          <Text style={styles.orderDate}>
            {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString()}
          </Text>
        </View>
        <View style={styles.earningsBox}>
          {item.status === 'delivered' ? (
            <>
              <Text style={styles.earningsLabel}>Earned</Text>
              <Text style={styles.earningsAmount}>₱{(item.rider_fee || 0).toFixed(2)}</Text>
            </>
          ) : (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledText}>Cancelled</Text>
            </View>
          )}
        </View>
      </View>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <Ionicons name="wallet" size={32} color="#4CAF50" />
          <Text style={styles.summaryLabel}>Total Earnings</Text>
          <Text style={styles.summaryAmount}>₱{totalEarnings.toFixed(2)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₱{todayEarnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{deliveredOrders.length}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
        </View>
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Delivery History</Text>
        <Text style={styles.historySubtitle}>{completedOrders.length} completed</Text>
      </View>

      <FlatList
        data={completedOrders}
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
            <Ionicons name="receipt-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No delivery history yet</Text>
            <Text style={styles.emptySubtext}>
              Your completed deliveries will appear here
            </Text>
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
  summarySection: {
    backgroundColor: '#FFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  summaryCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  historyHeader: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  historySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  earningsBox: {
    alignItems: 'flex-end',
  },
  earningsLabel: {
    fontSize: 12,
    color: '#666',
  },
  earningsAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 4,
  },
  cancelledBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cancelledText: {
    color: '#FFF',
    fontSize: 12,
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