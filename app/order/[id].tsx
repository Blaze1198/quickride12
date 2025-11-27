import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';

interface OrderItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  restaurant_name: string;
  items: OrderItem[];
  total_amount: number;
  subtotal?: number;
  delivery_fee?: number;
  rider_fee?: number;
  app_fee?: number;
  delivery_address: {
    address: string;
    latitude: number;
    longitude: number;
  };
  status: string;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState(35);
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  useEffect(() => {
    // Start pulse animation when order is loaded
    if (order) {
      startPulseAnimation();
    }
  }, [order]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/orders/${id}`);
      setOrder(response.data);
      calculateEstimatedTime(response.data);
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateEstimatedTime = (orderData: Order) => {
    if (!orderData) return;
    
    const prepTime = 15 + Math.floor(Math.random() * 6);
    const itemsTime = Math.ceil(orderData.items.length / 2);
    const deliveryTime = 10 + Math.floor(Math.random() * 6);
    
    let statusReduction = 0;
    if (orderData.status === 'confirmed' || orderData.status === 'ready_for_pickup') {
      statusReduction = 5;
    } else if (orderData.status === 'rider_assigned' || orderData.status === 'picked_up') {
      statusReduction = 15;
    } else if (orderData.status === 'out_for_delivery') {
      statusReduction = 20;
    } else if (orderData.status === 'delivered') {
      statusReduction = 100; // Already delivered
    }
    
    const total = Math.max(0, prepTime + itemsTime + deliveryTime - statusReduction);
    setEstimatedMinutes(total);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrder();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      case 'pending':
      case 'payment_pending':
        return '#FFC107';
      case 'preparing':
        return '#FF9800';
      case 'out_for_delivery':
        return '#2196F3';
      default:
        return '#9C27B0';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'checkmark-circle';
      case 'cancelled':
        return 'close-circle';
      case 'pending':
        return 'time';
      case 'preparing':
        return 'restaurant';
      case 'out_for_delivery':
      case 'picked_up':
        return 'bicycle';
      case 'ready_for_pickup':
        return 'cube';
      default:
        return 'information-circle';
    }
  };

  const formatStatus = (status: string) => {
    // Show "Ready for Pickup" when rider is assigned
    if (status === 'rider_assigned') {
      return 'Ready for Pickup';
    }
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusSteps = (currentStatus: string) => {
    const allSteps = [
      { key: 'preparing', label: 'Preparing Food' },
      { key: 'rider_assigned', label: 'Rider Assigned' },
      { key: 'out_for_delivery', label: 'Out for Delivery' },
      { key: 'delivered', label: 'Delivered' },
    ];

    const currentIndex = allSteps.findIndex((s) => s.key === currentStatus);
    return allSteps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      active: index === currentIndex,
    }));
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

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusSteps = getStatusSteps(order.status);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#210059']} />
        }
      >
        {/* Status Badge */}
        <View style={styles.statusCard}>
          <View
            style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}
          >
            <Ionicons name={getStatusIcon(order.status) as any} size={32} color="#FFF" />
          </View>
          <Text style={styles.statusTitle}>{formatStatus(order.status)}</Text>
          <Text style={styles.orderId}>Order #{order.id.substring(0, 8)}</Text>
        </View>

        {/* Animated Estimated Time Card - Below Status Card */}
        {estimatedMinutes > 0 && order.status !== 'delivered' && order.status !== 'cancelled' && (
          <Animated.View style={[styles.timeCard, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.timeCardText}>
              {estimatedMinutes - 5} — {estimatedMinutes + 5} mins
            </Text>
          </Animated.View>
        )}

        {/* Rider Info for rider_assigned status */}
        {order.status === 'rider_assigned' && order.rider_name && (
          <View style={styles.riderInfoCard}>
            <View style={styles.riderInfoHeader}>
              <Ionicons name="bicycle" size={24} color="#4CAF50" />
              <Text style={styles.riderInfoTitle}>Your Rider</Text>
            </View>
            <View style={styles.riderInfoBody}>
              <Text style={styles.riderNameText}>{order.rider_name}</Text>
              {order.rider_phone && (
                <Text style={styles.riderPhoneText}>📞 {order.rider_phone}</Text>
              )}
            </View>
          </View>
        )}

        {/* Status Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Status</Text>
          <View style={styles.timeline}>
            {statusSteps.map((step, index) => (
              <View key={step.key} style={styles.timelineItem}>
                <View style={styles.timelineIconContainer}>
                  {step.completed ? (
                    <View
                      style={[
                        styles.timelineIcon,
                        step.active ? styles.timelineIconActive : styles.timelineIconCompleted,
                      ]}
                    >
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    </View>
                  ) : (
                    <View style={styles.timelineIconInactive} />
                  )}
                  {index < statusSteps.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        step.completed ? styles.timelineLineCompleted : styles.timelineLineInactive,
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.timelineLabel,
                    step.active && styles.timelineLabelActive,
                    !step.completed && styles.timelineLabelInactive,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Restaurant Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Restaurant</Text>
          <View style={styles.infoRow}>
            <Ionicons name="restaurant" size={20} color="#210059" />
            <Text style={styles.infoText}>{order.restaurant_name}</Text>
          </View>
        </View>

        {/* Delivery Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color="#666" />
            <Text style={styles.infoText}>{order.delivery_address.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={20} color="#666" />
            <Text style={styles.infoText}>{order.customer_phone}</Text>
          </View>
          {order.special_instructions && (
            <View style={styles.infoRow}>
              <Ionicons name="chatbox" size={20} color="#666" />
              <Text style={styles.infoText}>{order.special_instructions}</Text>
            </View>
          )}
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {order.items.map((item, index) => (
            <View key={index} style={styles.orderItem}>
              <Text style={styles.orderItemQuantity}>{item.quantity}x</Text>
              <Text style={styles.orderItemName}>{item.name}</Text>
              <Text style={styles.orderItemPrice}>
                ₱{(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              ₱{(order.subtotal || order.total_amount).toFixed(2)}
            </Text>
          </View>

          {order.delivery_fee && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee (25%)</Text>
                <Text style={styles.summaryValue}>₱{order.delivery_fee.toFixed(2)}</Text>
              </View>
              
              {order.rider_fee && order.app_fee && (
                <View style={styles.feeBreakdown}>
                  <View style={styles.feeRow}>
                    <Ionicons name="bicycle" size={14} color="#999" />
                    <Text style={styles.feeLabel}>Rider (10%)</Text>
                    <Text style={styles.feeValue}>₱{order.rider_fee.toFixed(2)}</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Ionicons name="phone-portrait" size={14} color="#999" />
                    <Text style={styles.feeLabel}>App (15%)</Text>
                    <Text style={styles.feeValue}>₱{order.app_fee.toFixed(2)}</Text>
                  </View>
                </View>
              )}
            </>
          )}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₱{order.total_amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Order Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color="#666" />
            <Text style={styles.infoText}>
              {new Date(order.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  timeCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  timeCardText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#210059',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backButton: {
    padding: 12,
    backgroundColor: '#210059',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 14,
    color: '#999',
  },
  riderInfoCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  riderInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  riderInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 8,
  },
  riderInfoBody: {
    paddingLeft: 32,
  },
  riderNameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 6,
  },
  riderPhoneText: {
    fontSize: 16,
    color: '#388E3C',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconActive: {
    backgroundColor: '#210059',
  },
  timelineIconCompleted: {
    backgroundColor: '#4CAF50',
  },
  timelineIconInactive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  timelineLine: {
    width: 2,
    height: 32,
    marginTop: 4,
  },
  timelineLineCompleted: {
    backgroundColor: '#4CAF50',
  },
  timelineLineInactive: {
    backgroundColor: '#E0E0E0',
  },
  timelineLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    paddingTop: 2,
  },
  timelineLabelActive: {
    color: '#333',
    fontWeight: '600',
  },
  timelineLabelInactive: {
    color: '#999',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  orderItemQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#210059',
    width: 40,
  },
  orderItemName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  feeBreakdown: {
    marginLeft: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#E0E0E0',
    marginTop: 4,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  feeLabel: {
    flex: 1,
    fontSize: 12,
    color: '#999',
    marginLeft: 6,
  },
  feeValue: {
    fontSize: 12,
    color: '#999',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#210059',
  },
});
