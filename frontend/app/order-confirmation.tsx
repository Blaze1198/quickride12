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
  const [estimatedMinutes, setEstimatedMinutes] = useState(35);
  
  // Animation values
  const checkmarkScale = useState(new Animated.Value(0))[0];
  const checkmarkRotate = useState(new Animated.Value(0))[0];
  const confettiOpacity = useState(new Animated.Value(0))[0];
  const deliveryIconY = useState(new Animated.Value(0))[0];
  const deliveryIconOpacity = useState(new Animated.Value(0))[0];
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  useEffect(() => {
    // Start animations when order is loaded
    if (order) {
      startAnimations();
      calculateEstimatedTime();
    }
  }, [order]);

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

  const calculateEstimatedTime = () => {
    if (!order) return;
    
    // Base preparation time: 15-20 minutes
    const prepTime = 15 + Math.floor(Math.random() * 6);
    
    // Additional time based on number of items (1 min per 2 items)
    const itemsTime = Math.ceil(order.items.length / 2);
    
    // Delivery time: 10-15 minutes
    const deliveryTime = 10 + Math.floor(Math.random() * 6);
    
    const total = prepTime + itemsTime + deliveryTime;
    setEstimatedMinutes(total);
  };

  const startAnimations = () => {
    // Checkmark pop-in animation
    Animated.sequence([
      Animated.spring(checkmarkScale, {
        toValue: 1.2,
        tension: 50,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(checkmarkScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Checkmark rotation
    Animated.timing(checkmarkRotate, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();

    // Confetti fade in and out
    Animated.sequence([
      Animated.timing(confettiOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(confettiOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Delivery icon animation (floating up)
    Animated.loop(
      Animated.sequence([
        Animated.timing(deliveryIconY, {
          toValue: -10,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(deliveryIconY, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Fade in delivery icon
    Animated.timing(deliveryIconOpacity, {
      toValue: 1,
      duration: 800,
      delay: 400,
      useNativeDriver: true,
    }).start();

    // Pulse animation for estimated time
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
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
        {/* Success Header with Checkmark */}
        <View style={styles.successHeader}>
          <Animated.View 
            style={[
              styles.checkmarkCircle,
              {
                transform: [
                  { scale: checkmarkScale },
                  { 
                    rotate: checkmarkRotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg']
                    })
                  }
                ]
              }
            ]}
          >
            <Ionicons name="checkmark" size={60} color="#FFF" />
          </Animated.View>
          <Text style={styles.successTitle}>Order Placed!</Text>
        </View>

        {/* Top Card with Time Estimate */}
        <View style={styles.topCard}>
          <Animated.View 
            style={[
              styles.timeEstimateBox,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <Text style={styles.timeEstimateText}>
              {estimatedMinutes - 5} — {estimatedMinutes + 5} mins
            </Text>
          </Animated.View>
          
          {/* Delivery Info with Icon */}
          <View style={styles.deliveryInfoRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="gift" size={24} color="#FF1493" />
            </View>
            <View style={styles.deliveryTextContainer}>
              <Text style={styles.deliveryTitle}>Delivered by restaurant</Text>
              <Text style={styles.deliverySubtext}>
                Foodpanda has dispatched your order to {order.restaurant_name || 'the restaurant'}. They will deliver your order.
              </Text>
            </View>
          </View>
        </View>

        {/* Order Details Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          {/* Order Number Row */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order number</Text>
            <Text style={styles.detailValue}>#{order.id.slice(0, 8).toUpperCase()}</Text>
          </View>

          {/* Restaurant Row */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order from</Text>
            <Text style={styles.detailValue}>{order.restaurant_name}</Text>
          </View>

          {/* Delivery Address Row */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Delivery address</Text>
            <Text style={styles.detailValue}>
              {typeof order.delivery_address === 'string' 
                ? order.delivery_address 
                : order.delivery_address?.address || 'N/A'}
            </Text>
          </View>

          {/* Order Items */}
          {order.items.map((item: any, index: number) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemQuantityBox}>
                <Text style={styles.itemQuantityText}>{item.quantity}x</Text>
              </View>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.dividerLine} />

          {/* Payment Info */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment</Text>
            <Text style={styles.detailValue}>
              {order.payment_method === 'gcash' ? 'GCash' : 'Cash'}
            </Text>
          </View>

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total (Incl. VAT)</Text>
            <Text style={styles.totalValue}>₱{(order.total_amount || 0).toFixed(2)}</Text>
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
    padding: 16,
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
  topCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  timeEstimateBox: {
    marginBottom: 16,
  },
  timeEstimateText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  deliveryInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deliveryTextContainer: {
    flex: 1,
  },
  deliveryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deliverySubtext: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  sectionContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  confettiContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    height: 100,
    flexDirection: 'row',
    justifyContent: 'space-around',
    zIndex: 10,
  },
  confetti: {
    fontSize: 40,
    position: 'absolute',
    top: 0,
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
    marginBottom: 16,
  },
  deliveryIconContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  deliveryIconText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
    marginTop: 4,
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
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
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
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemQuantityBox: {
    width: 24,
    height: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemQuantityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
  },
  totalSection: {
    marginTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: '#F0F0F0',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
  simpleEstimatedTime: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  simpleEstimatedTimeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
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
