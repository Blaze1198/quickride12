import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, getTotalAmount, clearCart, restaurantId, restaurantName } = useCartStore();
  const { user } = useAuthStore();

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [latitude, setLatitude] = useState('14.5547');
  const [longitude, setLongitude] = useState('121.0244');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('gcash');
  const [gcashNumber, setGcashNumber] = useState('09609317687'); // Merchant number for display
  
  // Map location picker states
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tempLocation, setTempLocation] = useState({ lat: 14.5547, lng: 121.0244 });
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Calculate fees
  const subtotal = getTotalAmount();
  const riderFee = subtotal * 0.10; // 10% for rider
  const appFee = subtotal * 0.15; // 15% for application
  const deliveryFee = riderFee + appFee; // 25% total
  const total = subtotal + deliveryFee;

  const handlePlaceOrder = async () => {
    console.log('Place Order clicked');
    
    if (!deliveryAddress.trim()) {
      const msg = 'Please enter your delivery address';
      console.log('Validation error:', msg);
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Required', msg);
      }
      return;
    }

    if (!phoneNumber.trim()) {
      const msg = 'Please enter your phone number';
      console.log('Validation error:', msg);
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Required', msg);
      }
      return;
    }

    if (!restaurantId) {
      const msg = 'Restaurant ID is missing';
      console.error('Error:', msg);
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
      return;
    }

    console.log('Starting order placement...');
    setLoading(true);

    try {
      const orderData = {
        restaurant_id: restaurantId,
        items: items,
        total_amount: total,
        delivery_address: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address: deliveryAddress.trim(),
        },
        customer_phone: phoneNumber.trim(),
        special_instructions: specialInstructions.trim() || undefined,
        subtotal: subtotal,
        delivery_fee: deliveryFee,
        rider_fee: riderFee,
        app_fee: appFee,
      };

      console.log('Sending order data:', JSON.stringify(orderData, null, 2));

      // Add timeout to prevent infinite loading
      const response = await Promise.race([
        api.post('/orders', orderData),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout - Please check your connection')), 30000)
        )
      ]);

      console.log('Order created successfully:', response.data);
      const orderId = response.data.id;

      if (paymentMethod === 'gcash') {
        // Navigate to GCash payment screen
        router.push({
          pathname: '/gcash-payment',
          params: {
            orderId: orderId,
            amount: total.toFixed(2),
          }
        });
      } else {
        // Cash on delivery - show success message
        if (Platform.OS === 'web') {
          window.alert('Order placed successfully! 🎉 Check your Orders tab.');
        } else {
          Alert.alert('Success', 'Order placed successfully! 🎉 Check your Orders tab.');
        }

        clearCart();
        
        // Redirect to orders page
        setTimeout(() => {
          router.replace('/(customer)/orders');
        }, 1000);
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let message = 'Failed to place order. ';
      
      if (error.message === 'Request timeout - Please check your connection') {
        message = 'Request timeout. Please check your internet connection and try again.';
      } else if (error.response?.data?.detail) {
        message += error.response.data.detail;
      } else if (error.response?.status === 401) {
        message += 'Please login again.';
      } else if (error.message) {
        message += error.message;
      } else {
        message += 'Please try again.';
      }
      
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      console.log('Order placement finished, setting loading to false');
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/(customer)')}
          >
            <Text style={styles.backButtonText}>Browse Restaurants</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Restaurant Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order from</Text>
            <View style={styles.restaurantCard}>
              <Ionicons name="restaurant" size={24} color="#FF6B6B" />
              <Text style={styles.restaurantName}>{restaurantName}</Text>
            </View>
          </View>

          {/* Order Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Items</Text>
            {items.map((item) => (
              <View key={item.menu_item_id} style={styles.orderItem}>
                <Text style={styles.orderItemQuantity}>{item.quantity}x</Text>
                <Text style={styles.orderItemName}>{item.name}</Text>
                <Text style={styles.orderItemPrice}>
                  ₱{(item.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          {/* Delivery Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Delivery Address *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your complete address"
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  multiline
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+63 917 123 4567"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Special Instructions (Optional)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="chatbox-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Leave at door, Call upon arrival"
                  value={specialInstructions}
                  onChangeText={setSpecialInstructions}
                  multiline
                />
              </View>
            </View>
          </View>

          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₱{subtotal.toFixed(2)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryLabelContainer}>
                <Text style={styles.summaryLabel}>Delivery Fee (25%)</Text>
                <Text style={styles.summarySubtext}>10% Rider + 15% App</Text>
              </View>
              <Text style={styles.summaryValue}>₱{deliveryFee.toFixed(2)}</Text>
            </View>

            <View style={styles.feeBreakdown}>
              <View style={styles.feeRow}>
                <Ionicons name="bicycle" size={16} color="#666" />
                <Text style={styles.feeLabel}>Rider Fee (10%)</Text>
                <Text style={styles.feeValue}>₱{riderFee.toFixed(2)}</Text>
              </View>
              <View style={styles.feeRow}>
                <Ionicons name="phone-portrait" size={16} color="#666" />
                <Text style={styles.feeLabel}>App Service Fee (15%)</Text>
                <Text style={styles.feeValue}>₱{appFee.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₱{total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            
            {/* GCash Option */}
            <TouchableOpacity
              style={[
                styles.paymentCard,
                paymentMethod === 'gcash' && styles.paymentCardSelected
              ]}
              onPress={() => setPaymentMethod('gcash')}
            >
              <View style={styles.radioButton}>
                {paymentMethod === 'gcash' && <View style={styles.radioButtonInner} />}
              </View>
              <View style={styles.paymentIcon}>
                <Text style={styles.gcashText}>G</Text>
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentMethod}>GCash Payment</Text>
                <Text style={styles.paymentSubtext}>Pay securely via GCash</Text>
              </View>
            </TouchableOpacity>

            {/* Cash on Delivery Option */}
            <TouchableOpacity
              style={[
                styles.paymentCard,
                paymentMethod === 'cash' && styles.paymentCardSelected
              ]}
              onPress={() => setPaymentMethod('cash')}
            >
              <View style={styles.radioButton}>
                {paymentMethod === 'cash' && <View style={styles.radioButtonInner} />}
              </View>
              <Ionicons name="cash-outline" size={24} color="#4CAF50" />
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentMethod}>Cash on Delivery</Text>
                <Text style={styles.paymentSubtext}>Pay when your order arrives</Text>
              </View>
            </TouchableOpacity>

            {paymentMethod === 'gcash' && (
              <View style={styles.gcashInfo}>
                <Ionicons name="information-circle-outline" size={20} color="#0066CC" />
                <Text style={styles.gcashInfoText}>
                  You'll be directed to complete payment via GCash after placing your order
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Place Order Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.placeOrderButton, loading && styles.placeOrderButtonDisabled]}
            onPress={() => {
              console.log('Button pressed!');
              handlePlaceOrder();
            }}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.placeOrderButtonText}>Place Order</Text>
                <Text style={styles.placeOrderButtonSubtext}>₱{total.toFixed(2)}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
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
    paddingBottom: 100,
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
  restaurantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
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
    color: '#FF6B6B',
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabelContainer: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summarySubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  feeBreakdown: {
    marginLeft: 16,
    marginTop: 8,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#E0E0E0',
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
    marginLeft: 8,
  },
  feeValue: {
    fontSize: 12,
    color: '#999',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  paymentCardSelected: {
    borderColor: '#0066CC',
    backgroundColor: '#F0F8FF',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0066CC',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0066CC',
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gcashText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  paymentInfo: {
    marginLeft: 0,
    flex: 1,
  },
  paymentMethod: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  paymentSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  gcashInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#E6F2FF',
    borderRadius: 8,
    marginTop: 8,
  },
  gcashInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#0066CC',
    marginLeft: 8,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    zIndex: 1000,
  },
  placeOrderButton: {
    backgroundColor: '#FF6B6B',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  placeOrderButtonDisabled: {
    backgroundColor: '#FFB6B6',
  },
  placeOrderButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeOrderButtonSubtext: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 4,
    opacity: 0.9,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
