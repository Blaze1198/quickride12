import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { setAuthToken } from '../../utils/api';

interface DashboardData {
  users: {
    total: number;
    customers: number;
    restaurants: number;
    riders: number;
  };
  orders: {
    total: number;
    pending: number;
    active: number;
    completed: number;
  };
  revenue: {
    total: number;
  };
  recent_orders: any[];
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { logout: authLogout } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/admin/dashboard');
      setData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleLogout = () => {
    // Navigate to logout page instead of immediate logout
    router.push('/logout');
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#210059']} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Admin Dashboard</Text>
            <Text style={styles.subtitleText}>Monitor your platform</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#210059" />
          </TouchableOpacity>
        </View>

        {data && (
          <>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="people" size={32} color="#2196F3" />
                <Text style={styles.statNumber}>{data.users.total}</Text>
                <Text style={styles.statLabel}>Total Users</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="receipt" size={32} color="#FF9800" />
                <Text style={styles.statNumber}>{data.orders.total}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="restaurant" size={32} color="#4CAF50" />
                <Text style={styles.statNumber}>{data.users.restaurants}</Text>
                <Text style={styles.statLabel}>Restaurants</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="bicycle" size={32} color="#9C27B0" />
                <Text style={styles.statNumber}>{data.users.riders}</Text>
                <Text style={styles.statLabel}>Riders</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Status</Text>
              <View style={styles.orderStats}>
                <View style={styles.orderStatItem}>
                  <View style={[styles.orderStatDot, { backgroundColor: '#FFC107' }]} />
                  <Text style={styles.orderStatLabel}>Pending</Text>
                  <Text style={styles.orderStatNumber}>{data.orders.pending}</Text>
                </View>
                <View style={styles.orderStatItem}>
                  <View style={[styles.orderStatDot, { backgroundColor: '#2196F3' }]} />
                  <Text style={styles.orderStatLabel}>Active</Text>
                  <Text style={styles.orderStatNumber}>{data.orders.active}</Text>
                </View>
                <View style={styles.orderStatItem}>
                  <View style={[styles.orderStatDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.orderStatLabel}>Completed</Text>
                  <Text style={styles.orderStatNumber}>{data.orders.completed}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Revenue</Text>
              <View style={styles.revenueCard}>
                <Ionicons name="cash" size={48} color="#4CAF50" />
                <Text style={styles.revenueAmount}>₱{data.revenue.total.toFixed(2)}</Text>
                <Text style={styles.revenueLabel}>Total Revenue</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Orders</Text>
              {data.recent_orders.slice(0, 5).map((order, index) => (
                <View key={index} style={styles.orderItem}>
                  <View style={styles.orderItemHeader}>
                    <Text style={styles.orderItemId}>#{order.id.substring(0, 8)}</Text>
                    <Text style={styles.orderItemAmount}>₱{order.total_amount.toFixed(2)}</Text>
                  </View>
                  <Text style={styles.orderItemDetails}>
                    {order.customer_name} • {order.restaurant_name}
                  </Text>
                  <Text style={styles.orderItemStatus}>{order.status}</Text>
                </View>
              ))}
            </View>
          </>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitleText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  orderStats: {
    gap: 12,
  },
  orderStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderStatDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  orderStatLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  orderStatNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  revenueCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  revenueAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 12,
  },
  revenueLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  orderItem: {
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 12,
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderItemId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#210059',
  },
  orderItemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderItemDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderItemStatus: {
    fontSize: 12,
    color: '#999',
    textTransform: 'capitalize',
  },
});
