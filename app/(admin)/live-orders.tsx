import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import LiveOrdersMap from '../../components/LiveOrdersMap';

const { width } = Dimensions.get('window');
const IS_DESKTOP = width >= 1024;

interface RealtimeStats {
  active_orders: number;
  available_riders: number;
  busy_riders: number;
  open_restaurants: number;
  today_orders: number;
  today_revenue: number;
}

interface LiveOrder {
  id: string;
  customer_name: string;
  restaurant_name: string;
  status: string;
  total_amount: number;
  created_at: string;
  delivery_address: any;
  restaurant_location?: any;
  rider_location?: any;
}

export default function AdminLiveOrders() {
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<LiveOrder | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        api.get('/admin/stats/realtime'),
        api.get('/admin/orders/live'),
      ]);
      setStats(statsRes.data);
      setOrders(ordersRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching live data:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      pending: '#FFC107',
      paid: '#2196F3',
      accepted: '#9C27B0',
      preparing: '#FF9800',
      ready_for_pickup: '#210059',
      rider_assigned: '#00BCD4',
      picked_up: '#3F51B5',
      out_for_delivery: '#2196F3',
      delivered: '#4CAF50',
      cancelled: '#F44336',
    };
    return statusColors[status] || '#999';
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

  if (IS_DESKTOP && Platform.OS === 'web') {
    // Desktop layout with sidebar and map
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.desktopContainer}>
          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statCard}>
              <Ionicons name="fast-food" size={24} color="#210059" />
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.active_orders || 0}</Text>
                <Text style={styles.statLabel}>Active Orders</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="bicycle" size={24} color="#4CAF50" />
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.available_riders || 0}</Text>
                <Text style={styles.statLabel}>Available Riders</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time" size={24} color="#2196F3" />
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.busy_riders || 0}</Text>
                <Text style={styles.statLabel}>Busy Riders</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="restaurant" size={24} color="#9C27B0" />
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.open_restaurants || 0}</Text>
                <Text style={styles.statLabel}>Open Restaurants</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="receipt" size={24} color="#FF9800" />
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>{stats?.today_orders || 0}</Text>
                <Text style={styles.statLabel}>Today's Orders</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="cash" size={24} color="#4CAF50" />
              <View style={styles.statInfo}>
                <Text style={styles.statValue}>₱{stats?.today_revenue?.toFixed(2) || '0.00'}</Text>
                <Text style={styles.statLabel}>Today's Revenue</Text>
              </View>
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Sidebar - Orders List */}
            <View style={styles.sidebar}>
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Live Orders</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{orders.length}</Text>
                </View>
              </View>
              <ScrollView style={styles.ordersList} showsVerticalScrollIndicator={false}>
                {orders.map((order) => (
                  <TouchableOpacity
                    key={order.id}
                    style={[
                      styles.orderCard,
                      selectedOrder?.id === order.id && styles.selectedOrderCard,
                    ]}
                    onPress={() => {
                      setSelectedOrder(order);
                      setShowOrderDetail(true);
                    }}
                  >
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderId}>#{order.id.substring(0, 8)}</Text>
                      <View
                        style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}
                      >
                        <Text style={styles.statusText}>
                          {order.status.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.orderCustomer}>{order.customer_name}</Text>
                    <Text style={styles.orderRestaurant}>{order.restaurant_name}</Text>
                    <View style={styles.orderFooter}>
                      <Text style={styles.orderAmount}>₱{order.total_amount.toFixed(2)}</Text>
                      <Text style={styles.orderTime}>
                        {new Date(order.created_at).toLocaleTimeString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {orders.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="checkmark-circle-outline" size={64} color="#CCC" />
                    <Text style={styles.emptyText}>No active orders</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Map View */}
            <View style={styles.mapContainer}>
              <LiveOrdersMap orders={orders} />
            </View>
          </View>
        </View>

        {/* Order Detail Modal */}
        <Modal
          visible={showOrderDetail && selectedOrder !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOrderDetail(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Order Details</Text>
                <TouchableOpacity onPress={() => setShowOrderDetail(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              {selectedOrder && (
                <ScrollView style={styles.modalBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Order ID:</Text>
                    <Text style={styles.detailValue}>#{selectedOrder.id.substring(0, 16)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(selectedOrder.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {selectedOrder.status.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.customer_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Restaurant:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.restaurant_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Amount:</Text>
                    <Text style={styles.detailValue}>₱{selectedOrder.total_amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Delivery Address:</Text>
                    <Text style={styles.detailValue}>
                      {selectedOrder.delivery_address?.address || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Created At:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedOrder.created_at).toLocaleString()}
                    </Text>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Mobile layout (fallback)
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.mobileContent}>
        <Text style={styles.mobileTitle}>Live Orders</Text>
        <Text style={styles.mobileSubtitle}>Use desktop for full monitoring experience</Text>
        
        {stats && (
          <View style={styles.mobileStats}>
            <View style={styles.mobileStatCard}>
              <Text style={styles.mobileStatValue}>{stats.active_orders}</Text>
              <Text style={styles.mobileStatLabel}>Active Orders</Text>
            </View>
            <View style={styles.mobileStatCard}>
              <Text style={styles.mobileStatValue}>{stats.available_riders}</Text>
              <Text style={styles.mobileStatLabel}>Available Riders</Text>
            </View>
          </View>
        )}

        {orders.map((order) => (
          <View key={order.id} style={styles.mobileOrderCard}>
            <Text style={styles.orderId}>#{order.id.substring(0, 8)}</Text>
            <Text style={styles.orderCustomer}>{order.customer_name}</Text>
            <Text style={styles.orderRestaurant}>{order.restaurant_name}</Text>
            <View
              style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}
            >
              <Text style={styles.statusText}>{order.status.replace(/_/g, ' ')}</Text>
            </View>
          </View>
        ))}
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
  desktopContainer: {
    flex: 1,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 16,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 350,
    backgroundColor: '#FFF',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  badge: {
    backgroundColor: '#210059',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  ordersList: {
    flex: 1,
  },
  orderCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFF',
  },
  selectedOrderCard: {
    backgroundColor: '#FFF5F5',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#210059',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderCustomer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  orderRestaurant: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  orderTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  mapContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 500,
    maxHeight: '80%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  mobileContent: {
    padding: 16,
  },
  mobileTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  mobileSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  mobileStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  mobileStatCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  mobileStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#210059',
  },
  mobileStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  mobileOrderCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
});
