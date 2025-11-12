import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../utils/api';

export default function OrderConfirmationScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setOrder(response.data);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B6B" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>Order not found</Text>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.replace('/(customer)' as any)}
          >
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <View style={styles.checkmarkCircle}>
            <Ionicons name="checkmark" size={60} color="#FFF" />
          </View>
          <Text style={styles.successTitle}>Order Placed!</Text>
          <Text style={styles.successSubtitle}>
            Thank you for your order
          </Text>
        </View>

        {/* Receipt Card */}
        <View style={styles.receiptCard}>
          {/* Order Number */}
          <View style={styles.orderNumberSection}>
            <Text style={styles.orderNumberLabel}>Order Number</Text>
            <Text style={styles.orderNumber}>#{order.id.slice(0, 8).toUpperCase()}</Text>
          </View>

          <View style={styles.divider} />

          {/* Restaurant Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="restaurant" size={20} color="#FF6B6B" />
              <Text style={styles.sectionTitle}>Restaurant</Text>
            </View>
            <Text style={styles.restaurantName}>{order.restaurant_name}</Text>
          </View>

          <View style={styles.divider} />

          {/* Delivery Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color="#FF6B6B" />
              <Text style={styles.sectionTitle}>Delivery Address</Text>
            </View>
            <Text style={styles.infoText}>
              {typeof order.delivery_address === 'string' 
                ? order.delivery_address 
                : order.delivery_address?.address || 'Delivery address not available'}
            </Text>
            <View style={styles.phoneRow}>
              <Ionicons name="call" size={16} color="#666" />
              <Text style={styles.phoneText}>{order.phone || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Order Items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="receipt" size={20} color="#FF6B6B" />
              <Text style={styles.sectionTitle}>Order Details</Text>
            </View>
            {order.items.map((item: any, index: number) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                  <Text style={styles.itemName}>{item.name}</Text>
                </View>
                <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Total Section */}
          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>₱{order.total_amount.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery Fee</Text>
              <Text style={styles.totalValue}>₱{(order.delivery_fee || 50).toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                ₱{((order.total_amount || 0) + (order.delivery_fee || 50)).toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Payment Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="card" size={20} color="#FF6B6B" />
              <Text style={styles.sectionTitle}>Payment Method</Text>
            </View>
            <Text style={styles.infoText}>
              {order.payment_method === 'gcash' ? 'GCash' : 'Cash on Delivery'}
            </Text>
          </View>

          {/* Estimated Time */}
          <View style={styles.estimatedTimeBox}>
            <Ionicons name="time" size={24} color="#4CAF50" />
            <View style={styles.estimatedTimeContent}>
              <Text style={styles.estimatedTimeLabel}>Estimated Delivery</Text>
              <Text style={styles.estimatedTimeValue}>30-45 minutes</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.trackButton}
          onPress={() => router.replace('/(customer)/orders' as any)}
        >
          <Ionicons name="navigate" size={20} color="#FFF" />
          <Text style={styles.trackButtonText}>Track Your Order</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/(customer)' as any)}
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            You will receive updates about your order via notifications
          </Text>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
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
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#333',
    marginTop: 16,
    marginBottom: 24,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  checkmarkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  receiptCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  orderNumberSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  orderNumberLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  infoText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  phoneText: {
    fontSize: 15,
    color: '#666',
    marginLeft: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemQuantity: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
    minWidth: 30,
  },
  itemName: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  totalSection: {
    marginTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalLabel: {
    fontSize: 15,
    color: '#666',
  },
  totalValue: {
    fontSize: 15,
    color: '#666',
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  estimatedTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  estimatedTimeContent: {
    marginLeft: 12,
  },
  estimatedTimeLabel: {
    fontSize: 14,
    color: '#666',
  },
  estimatedTimeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  trackButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B6B',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B6B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  trackButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  homeButton: {
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    marginBottom: 16,
  },
  homeButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
});
