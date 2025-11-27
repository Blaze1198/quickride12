import React, { useEffect, useState, useRef } from 'react';
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
  const mapRef = useRef<any>(null);
  
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
      initializeBackgroundMap();
    }
  }, [order]);

  const initializeBackgroundMap = () => {
    if (Platform.OS !== 'web' || !mapRef.current || !order) return;

    try {
      // Get delivery location
      let lat, lng;
      if (typeof order.delivery_address === 'string') {
        // Default location if address is just a string
        lat = 14.5995; // Manila default
        lng = 120.9842;
      } else if (order.delivery_address?.latitude && order.delivery_address?.longitude) {
        lat = order.delivery_address.latitude;
        lng = order.delivery_address.longitude;
      } else {
        lat = 14.5995;
        lng = 120.9842;
      }

      const google = (window as any).google;
      if (!google) return;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 15,
        disableDefaultUI: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        styles: [
          {
            featureType: 'all',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Add marker for delivery location
      new google.maps.Marker({
        position: { lat, lng },
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#210059',
          fillOpacity: 1,
          strokeColor: '#FFF',
          strokeWeight: 3,
        },
      });
    } catch (error) {
      console.error('Error initializing background map:', error);
    }
  };

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
          <ActivityIndicator size="large" color="#210059" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#210059" />
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
      {/* Blurred Map Background */}
      {Platform.OS === 'web' && order && (
        <View style={styles.mapBackground}>
          <div 
            ref={mapRef} 
            style={{ 
              width: '100%', 
              height: '100%',
              filter: 'blur(8px)',
              opacity: 0.6
            }} 
          />
          <View style={styles.mapOverlay} />
        </View>
      )}
      
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
        </View>

        {/* Order Status Timeline Card */}
        <View style={styles.statusTimelineCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIconCircle}>
              <Ionicons 
                name={
                  order.status === 'delivered' ? 'checkmark' :
                  order.status === 'out_for_delivery' ? 'bicycle' :
                  order.status === 'rider_assigned' ? 'person' :
                  'restaurant'
                } 
                size={32} 
                color="#FFF" 
              />
            </View>
            <View style={styles.statusHeaderText}>
              <Text style={styles.statusMainText}>
                {order.status === 'pending' ? 'Order Received' :
                 order.status === 'confirmed' ? 'Preparing' :
                 order.status === 'ready_for_pickup' ? 'Ready' :
                 order.status === 'rider_assigned' ? 'Rider Assigned' :
                 order.status === 'picked_up' ? 'Picked Up' :
                 order.status === 'out_for_delivery' ? 'Out for Delivery' :
                 order.status === 'delivered' ? 'Delivered' :
                 'Preparing'}
              </Text>
              <Text style={styles.statusOrderId}>Order #{order.id.slice(0, 8).toUpperCase()}</Text>
            </View>
          </View>

          {/* Status Timeline */}
          <View style={styles.timelineContainer}>
            <Text style={styles.timelineTitle}>Order Status</Text>
            
            {/* Preparing Food */}
            <View style={styles.timelineItem}>
              <View style={[
                styles.timelineDot,
                (order.status === 'confirmed' || order.status === 'ready_for_pickup' || 
                 order.status === 'rider_assigned' || order.status === 'picked_up' || 
                 order.status === 'out_for_delivery' || order.status === 'delivered') && styles.timelineDotActive
              ]} />
              <View style={styles.timelineLine} />
              <Text style={[
                styles.timelineLabel,
                (order.status === 'confirmed' || order.status === 'ready_for_pickup' || 
                 order.status === 'rider_assigned' || order.status === 'picked_up' || 
                 order.status === 'out_for_delivery' || order.status === 'delivered') && styles.timelineLabelActive
              ]}>Preparing Food</Text>
            </View>

            {/* Rider Assigned */}
            <View style={styles.timelineItem}>
              <View style={[
                styles.timelineDot,
                (order.status === 'rider_assigned' || order.status === 'picked_up' || 
                 order.status === 'out_for_delivery' || order.status === 'delivered') && styles.timelineDotActive
              ]} />
              <View style={styles.timelineLine} />
              <Text style={[
                styles.timelineLabel,
                (order.status === 'rider_assigned' || order.status === 'picked_up' || 
                 order.status === 'out_for_delivery' || order.status === 'delivered') && styles.timelineLabelActive
              ]}>Rider Assigned</Text>
            </View>

            {/* Out for Delivery */}
            <View style={styles.timelineItem}>
              <View style={[
                styles.timelineDot,
                (order.status === 'out_for_delivery' || order.status === 'delivered') && styles.timelineDotActive
              ]} />
              <View style={styles.timelineLine} />
              <Text style={[
                styles.timelineLabel,
                (order.status === 'out_for_delivery' || order.status === 'delivered') && styles.timelineLabelActive
              ]}>Out for Delivery</Text>
            </View>

            {/* Delivered */}
            <View style={styles.timelineItem}>
              <View style={[
                styles.timelineDot,
                order.status === 'delivered' && styles.timelineDotActive
              ]} />
              <Text style={[
                styles.timelineLabel,
                order.status === 'delivered' && styles.timelineLabelActive
              ]}>Delivered</Text>
            </View>
          </View>

          {/* Restaurant Info */}
          <View style={styles.restaurantSection}>
            <Text style={styles.restaurantSectionTitle}>Restaurant</Text>
            <View style={styles.restaurantInfo}>
              <Ionicons name="close" size={20} color="#210059" />
              <Text style={styles.restaurantName}>{order.restaurant_name}</Text>
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

          {/* Order Status Row */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order status</Text>
            <Text style={[styles.detailValue, styles.statusText]}>
              {order.status === 'pending' ? 'Order Received' :
               order.status === 'confirmed' ? 'Preparing Your Order' :
               order.status === 'ready_for_pickup' ? 'Ready for Pickup' :
               order.status === 'rider_assigned' ? 'Rider on the Way' :
               order.status === 'picked_up' ? 'Order Picked Up' :
               order.status === 'out_for_delivery' ? 'Out for Delivery' :
               order.status === 'delivered' ? 'Delivered' :
               'Preparing Your Order'}
            </Text>
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
          onPress={() => router.push(`/live-order-tracking?orderId=${orderId}` as any)}
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
  mapBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    zIndex: 1,
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
    backgroundColor: '#210059',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#210059',
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
    color: '#210059',
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
    color: '#210059',
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
    color: '#210059',
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
  statusText: {
    color: '#210059',
    fontWeight: '600',
  },
  statusTimelineCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
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
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusHeaderText: {
    flex: 1,
  },
  statusMainText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statusOrderId: {
    fontSize: 12,
    color: '#999',
  },
  timelineContainer: {
    marginBottom: 20,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
    marginRight: 12,
    marginTop: 4,
  },
  timelineDotActive: {
    borderColor: '#210059',
    backgroundColor: '#210059',
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    width: 2,
    height: 24,
    backgroundColor: '#DDD',
  },
  timelineLabel: {
    fontSize: 14,
    color: '#999',
    flex: 1,
  },
  timelineLabelActive: {
    color: '#333',
    fontWeight: '500',
  },
  restaurantSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
  },
  restaurantSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 14,
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
    color: '#210059',
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
    backgroundColor: '#210059',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#210059',
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
    borderColor: '#210059',
    marginBottom: 16,
  },
  homeButtonText: {
    color: '#210059',
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
