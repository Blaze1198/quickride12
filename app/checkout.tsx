import React, { useState, useRef, useEffect } from 'react';
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
  const { items, getTotalAmount, clearCart, restaurantId, restaurantName, updateQuantity, removeItem } = useCartStore();
  const { user } = useAuthStore();

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [latitude, setLatitude] = useState('14.5547');
  const [longitude, setLongitude] = useState('121.0244');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('gcash');
  const [gcashNumber, setGcashNumber] = useState('09609317687'); // Merchant number for display
  
  // Error states for validation
  const [phoneError, setPhoneError] = useState(false);
  const [addressError, setAddressError] = useState(false);
  const scrollViewRef = useRef<any>(null);
  const phoneInputRef = useRef<any>(null);
  
  // Location verification modal
  const [showLocationVerification, setShowLocationVerification] = useState(false);
  const [verificationMapLoaded, setVerificationMapLoaded] = useState(false);
  const verificationMapRef = useRef<any>(null);

  // Load location from home screen on mount
  useEffect(() => {
    try {
      const savedLocation = localStorage.getItem('deliveryLocation');
      if (savedLocation) {
        const location = JSON.parse(savedLocation);
        setDeliveryAddress(location.address || '');
        setLatitude(location.latitude?.toString() || '14.5547');
        setLongitude(location.longitude?.toString() || '121.0244');
        console.log('✅ Loaded delivery location from home screen:', location);
      }
    } catch (error) {
      console.error('Error loading saved location:', error);
    }
  }, []);
  
  // Map location picker states
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tempLocation, setTempLocation] = useState({ lat: 14.5547, lng: 121.0244 });
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Handle quantity changes
  const handleIncreaseQuantity = (menuItemId: string) => {
    const item = items.find(i => i.menu_item_id === menuItemId);
    if (item) {
      updateQuantity(menuItemId, item.quantity + 1);
    }
  };

  const handleDecreaseQuantity = (menuItemId: string) => {
    const item = items.find(i => i.menu_item_id === menuItemId);
    if (item) {
      if (item.quantity === 1) {
        // Remove item if quantity would become 0
        if (Platform.OS === 'web') {
          if (window.confirm('Remove this item from cart?')) {
            removeItem(menuItemId);
          }
        } else {
          Alert.alert(
            'Remove Item',
            'Remove this item from cart?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', onPress: () => removeItem(menuItemId), style: 'destructive' },
            ]
          );
        }
      } else {
        updateQuantity(menuItemId, item.quantity - 1);
      }
    }
  };

  // Calculate fees
  const subtotal = getTotalAmount();
  const riderFee = subtotal * 0.10; // 10% for rider
  const appFee = subtotal * 0.15; // 15% for application
  const deliveryFee = riderFee + appFee; // 25% total
  const total = subtotal + deliveryFee;

  // Open map picker and get current location
  const openMapPicker = () => {
    setTempLocation({
      lat: parseFloat(latitude) || 14.5547,
      lng: parseFloat(longitude) || 121.0244
    });
    setMapLoaded(false); // Reset map state
    setShowMapPicker(true);
    
    console.log('📍 Opening map picker...');
    
    // Get user's current location
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      console.log('🔍 Requesting geolocation...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setTempLocation(newLocation);
          console.log('✅ Got current location:', newLocation);
        },
        (error) => {
          console.error('❌ Error getting location:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  // Load Google Maps and initialize map
  const loadMapPicker = () => {
    console.log('🗺️ loadMapPicker called');
    if (typeof window === 'undefined') {
      console.log('❌ Window is undefined');
      return;
    }

    console.log('✅ Window is defined');
    const apiKey = 'AIzaSyA0m1oRlXLQWjxacqjEJ6zJW3WvmOWvQkQ';

    if ((window as any).google && (window as any).google.maps) {
      console.log('✅ Google Maps already loaded, initializing...');
      setTimeout(() => initializeMapPicker(), 100);
      return;
    }

    console.log('🔄 Google Maps not loaded, checking for existing script...');
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('✅ Script tag exists, waiting for Google Maps to load...');
      const checkInterval = setInterval(() => {
        if ((window as any).google && (window as any).google.maps) {
          clearInterval(checkInterval);
          console.log('✅ Google Maps loaded from existing script');
          initializeMapPicker();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!mapLoaded) {
          console.error('⏱️ Timeout waiting for Google Maps');
        }
      }, 10000);
      return;
    }

    console.log('📝 Creating new Google Maps script tag...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('✅ Script loaded, waiting for google.maps...');
      setTimeout(() => {
        if ((window as any).google && (window as any).google.maps) {
          console.log('✅ Google Maps API ready!');
          initializeMapPicker();
        } else {
          console.error('❌ Google Maps API not available after script load');
        }
      }, 100);
    };
    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps script:', error);
    };
    document.head.appendChild(script);
    console.log('✅ Script tag appended to document');
  };

  // Initialize interactive map
  const initializeMapPicker = () => {
    console.log('🗺️ initializeMapPicker called');
    const google = (window as any).google;
    if (!google) {
      console.error('❌ Google object not available');
      return;
    }
    if (!mapRef.current) {
      console.error('❌ Map ref not available');
      return;
    }

    console.log('✅ Creating map with center:', tempLocation);

    const map = new google.maps.Map(mapRef.current, {
      center: tempLocation,
      zoom: 16,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    console.log('✅ Map created, adding marker...');

    // Add draggable marker
    const marker = new google.maps.Marker({
      position: tempLocation,
      map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 15,
        fillColor: '#210059',
        fillOpacity: 1,
        strokeColor: '#FFF',
        strokeWeight: 3,
      },
    });

    console.log('✅ Marker added');
    markerRef.current = marker;

    // Update location when marker is dragged
    marker.addListener('dragend', () => {
      const position = marker.getPosition();
      const newLocation = {
        lat: position.lat(),
        lng: position.lng()
      };
      console.log('📍 Marker dragged to:', newLocation);
      setTempLocation(newLocation);
      getAddressFromCoordinates(newLocation.lat, newLocation.lng);
    });

    // Update location when map is clicked
    map.addListener('click', (event: any) => {
      const newLocation = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      console.log('📍 Map clicked at:', newLocation);
      marker.setPosition(newLocation);
      setTempLocation(newLocation);
      getAddressFromCoordinates(newLocation.lat, newLocation.lng);
    });

    // Get initial address
    getAddressFromCoordinates(tempLocation.lat, tempLocation.lng);
    
    setMapLoaded(true);
    console.log('✅ Map initialization complete!');
  };

  // Reverse geocoding to get address from coordinates
  const getAddressFromCoordinates = async (lat: number, lng: number) => {
    const google = (window as any).google;
    if (!google) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
      if (status === 'OK' && results[0]) {
        setDeliveryAddress(results[0].formatted_address);
      }
    });
  };

  // Confirm selected location
  const confirmLocation = () => {
    setLatitude(tempLocation.lat.toString());
    setLongitude(tempLocation.lng.toString());
    setShowMapPicker(false);
    console.log('Location confirmed:', tempLocation, deliveryAddress);
  };

  // Load Google Maps for verification modal
  const loadVerificationMap = () => {
    console.log('🗺️ loadVerificationMap called');
    if (typeof window === 'undefined') {
      console.log('❌ Window is undefined');
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDJqsXxZXuu808lFZXARvy4rd0xktuqwJQ';
    console.log('📍 Using API key:', apiKey.substring(0, 20) + '...');

    if ((window as any).google && (window as any).google.maps) {
      console.log('✅ Google Maps already loaded, initializing...');
      setTimeout(() => initializeVerificationMap(), 100);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('📜 Google Maps script exists, waiting for load...');
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if ((window as any).google && (window as any).google.maps) {
          console.log(`✅ Google Maps loaded after ${attempts} attempts`);
          clearInterval(checkInterval);
          initializeVerificationMap();
        } else if (attempts > 50) {
          console.log('❌ Timeout waiting for Google Maps');
          clearInterval(checkInterval);
          setVerificationMapLoaded(true); // Show the div even if map fails
        }
      }, 100);
      return;
    }

    console.log('📥 Loading Google Maps script...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('✅ Google Maps script loaded');
      setTimeout(() => {
        if ((window as any).google && (window as any).google.maps) {
          initializeVerificationMap();
        } else {
          console.log('❌ Google object not available after script load');
          setVerificationMapLoaded(true);
        }
      }, 200);
    };
    script.onerror = () => {
      console.error('❌ Failed to load Google Maps script');
      setVerificationMapLoaded(true);
    };
    document.head.appendChild(script);
  };

  // Initialize verification map
  const initializeVerificationMap = () => {
    console.log('🗺️ initializeVerificationMap called');
    const google = (window as any).google;
    
    if (!google || !google.maps) {
      console.log('❌ Google Maps not available');
      setVerificationMapLoaded(true);
      return;
    }
    
    if (!verificationMapRef.current) {
      console.log('❌ Map ref not available, retrying...');
      setTimeout(() => initializeVerificationMap(), 200);
      return;
    }

    console.log('✅ Both Google Maps and ref available, creating map...');
    console.log('📍 Location:', latitude, longitude);

    try {
      const location = {
        lat: parseFloat(latitude) || 14.5547,
        lng: parseFloat(longitude) || 121.0244
      };

      const map = new google.maps.Map(verificationMapRef.current, {
        center: location,
        zoom: 17,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });

      // Add marker
      const marker = new google.maps.Marker({
        position: location,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 18,
          fillColor: '#210059',
          fillOpacity: 1,
          strokeColor: '#FFF',
          strokeWeight: 4,
        },
        title: 'Your Delivery Location',
      });

      // Add pulsing circle
      const pulsingCircle = new google.maps.Circle({
        map: map,
        center: location,
        radius: 30,
        fillColor: '#210059',
        fillOpacity: 0.2,
        strokeColor: '#210059',
        strokeOpacity: 0.6,
        strokeWeight: 2,
      });

      // Animate pulsing
      let growing = true;
      let radius = 30;
      const pulseInterval = setInterval(() => {
        if (growing) {
          radius += 2;
          if (radius >= 60) growing = false;
        } else {
          radius -= 2;
          if (radius <= 30) growing = true;
        }
        pulsingCircle.setRadius(radius);
      }, 100);

      console.log('✅ Verification map initialized successfully');
      setVerificationMapLoaded(true);
    } catch (error) {
      console.error('❌ Error initializing map:', error);
      setVerificationMapLoaded(true);
    }
  };

  // Modified handlePlaceOrder - shows verification modal first
  const handlePlaceOrder = async () => {
    console.log('🛒 Place Order clicked');
    console.log('📍 Delivery Address:', deliveryAddress);
    console.log('📱 Phone Number:', phoneNumber);
    console.log('🏪 Restaurant ID:', restaurantId);
    
    // Reset error states
    setAddressError(false);
    setPhoneError(false);
    
    // Validate fields
    let hasError = false;
    
    if (!deliveryAddress.trim()) {
      setAddressError(true);
      hasError = true;
      console.log('❌ Validation error: Missing delivery address');
    }

    if (!phoneNumber.trim()) {
      setPhoneError(true);
      hasError = true;
      console.log('❌ Validation error: Missing phone number');
      
      // Scroll to phone number field
      if (phoneInputRef.current) {
        phoneInputRef.current.focus();
      }
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 300, animated: true });
      }
      return;
    }

    if (hasError) {
      // Scroll to first error
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: true });
      }
      return;
    }

    if (!restaurantId) {
      const msg = 'Restaurant ID is missing';
      console.error('❌ Error:', msg);
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
      return;
    }

    // Show location verification modal before placing order
    console.log('✅ All validations passed. Opening location verification modal');
    setShowLocationVerification(true);
    setVerificationMapLoaded(false);
    loadVerificationMap();
  };

  // Confirm and place order after location verification
  const confirmAndPlaceOrder = async () => {
    console.log('🛒 Confirm and Place Order clicked');
    console.log('👤 Current user:', user);
    console.log('👤 User role:', user?.role);
    
    // Close verification modal
    setShowLocationVerification(false);
    
    console.log('⏳ Setting loading to true');
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
        // Cash on delivery - redirect to order confirmation page
        clearCart();
        
        // Navigate to order confirmation page
        router.replace(`/order-confirmation?orderId=${orderId}` as any);
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let message = 'Failed to place order. ';
      
      if (error.message === 'Request timeout - Please check your connection') {
        message = 'Request timeout. Please check your internet connection and try again.';
      } else if (error.response?.status === 403) {
        message = 'Only customers can place orders. Please login with a customer account.';
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

  // Load map when modal opens
  React.useEffect(() => {
    if (showMapPicker && Platform.OS === 'web') {
      loadMapPicker();
    }
  }, [showMapPicker]);

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

        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
          {/* Restaurant Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order from</Text>
            <View style={styles.restaurantCard}>
              <Ionicons name="restaurant" size={24} color="#210059" />
              <Text style={styles.restaurantName}>{restaurantName}</Text>
            </View>
          </View>

          {/* Order Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Items</Text>
            {items.map((item) => (
              <View key={item.menu_item_id} style={styles.orderItem}>
                <View style={styles.itemLeft}>
                  <Text style={styles.orderItemName}>{item.name}</Text>
                  <Text style={styles.orderItemPrice}>₱{item.price.toFixed(2)} each</Text>
                </View>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => handleDecreaseQuantity(item.menu_item_id)}
                  >
                    <Ionicons name="remove" size={20} color="#210059" />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => handleIncreaseQuantity(item.menu_item_id)}
                  >
                    <Ionicons name="add" size={20} color="#210059" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.orderItemTotal}>
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
              {Platform.OS === 'web' && (
                <TouchableOpacity 
                  style={styles.mapButton}
                  onPress={openMapPicker}
                >
                  <Ionicons name="map" size={20} color="#FFF" />
                  <Text style={styles.mapButtonText}>Select Location on Map</Text>
                </TouchableOpacity>
              )}
              {latitude && longitude && (
                <Text style={styles.coordinatesText}>
                  📍 Lat: {parseFloat(latitude).toFixed(6)}, Lng: {parseFloat(longitude).toFixed(6)}
                </Text>
              )}
            </View>

            <View style={styles.inputGroup} ref={phoneInputRef}>
              <Text style={styles.label}>Phone Number *</Text>
              <View style={[styles.inputContainer, phoneError && styles.inputContainerError]}>
                <Ionicons name="call-outline" size={20} color={phoneError ? "#210059" : "#666"} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+63 917 123 4567"
                  value={phoneNumber}
                  onChangeText={(text) => {
                    setPhoneNumber(text);
                    if (phoneError) setPhoneError(false); // Clear error when user starts typing
                  }}
                  keyboardType="phone-pad"
                />
              </View>
              {phoneError && (
                <Text style={styles.errorText}>Please enter your phone number</Text>
              )}
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
                  You&apos;ll be directed to complete payment via GCash after placing your order
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

      {/* Map Location Picker Modal */}
      <Modal
        visible={showMapPicker}
        animationType="slide"
        onRequestClose={() => setShowMapPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Map Header */}
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Select Delivery Location</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Map Container */}
          {Platform.OS === 'web' ? (
            <View style={styles.mapPickerContainer}>
              {!mapLoaded && (
                <View style={styles.mapLoading}>
                  <ActivityIndicator size="large" color="#210059" />
                  <Text style={styles.mapLoadingText}>Loading map...</Text>
                </View>
              )}
              <View style={{ flex: 1, opacity: mapLoaded ? 1 : 0 }}>
                {/* @ts-ignore - Web-specific div for Google Maps */}
                <div 
                  ref={mapRef} 
                  style={{ 
                    width: '100%', 
                    height: '100%',
                  }} 
                />
              </View>
            </View>
          ) : null}

          {/* Address Display */}
          <View style={styles.mapAddressContainer}>
            <View style={styles.mapAddressCard}>
              <Ionicons name="location" size={24} color="#210059" />
              <View style={styles.mapAddressTextContainer}>
                <Text style={styles.mapAddressLabel}>Delivery Address</Text>
                <Text style={styles.mapAddressText} numberOfLines={2}>
                  {deliveryAddress || 'Drag the marker to select location'}
                </Text>
                <Text style={styles.mapCoordinates}>
                  📍 {tempLocation.lat.toFixed(6)}, {tempLocation.lng.toFixed(6)}
                </Text>
              </View>
            </View>
          </View>

          {/* Confirm Button */}
          <View style={styles.mapFooter}>
            <TouchableOpacity
              style={styles.confirmLocationButton}
              onPress={confirmLocation}
            >
              <Ionicons name="checkmark-circle" size={24} color="#FFF" />
              <Text style={styles.confirmLocationText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Location Verification Modal */}
      <Modal
        visible={showLocationVerification}
        animationType="slide"
        onRequestClose={() => setShowLocationVerification(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowLocationVerification(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Verify Delivery Location</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Map Container */}
          {Platform.OS === 'web' ? (
            <View style={styles.mapPickerContainer}>
              {!verificationMapLoaded && (
                <View style={styles.mapLoading}>
                  <ActivityIndicator size="large" color="#210059" />
                  <Text style={styles.mapLoadingText}>Loading verification map...</Text>
                </View>
              )}
              <View style={{ flex: 1, opacity: verificationMapLoaded ? 1 : 0 }}>
                {/* @ts-ignore - Web-specific div for Google Maps */}
                <div 
                  ref={verificationMapRef} 
                  style={{ 
                    width: '100%', 
                    height: '100%',
                  }} 
                />
              </View>
            </View>
          ) : null}

          {/* Address Display */}
          <View style={styles.mapAddressContainer}>
            <View style={styles.mapAddressCard}>
              <Ionicons name="location" size={24} color="#210059" />
              <View style={styles.mapAddressTextContainer}>
                <Text style={styles.mapAddressLabel}>Delivery Address</Text>
                <Text style={styles.mapAddressText} numberOfLines={3}>
                  {deliveryAddress}
                </Text>
                <Text style={styles.mapCoordinates}>
                  📍 {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
                </Text>
              </View>
            </View>
            
            <View style={styles.verificationNote}>
              <Ionicons name="information-circle" size={20} color="#0066CC" />
              <Text style={styles.verificationNoteText}>
                Please verify this is your correct delivery location. Your order will be delivered to this address.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.mapFooter}>
            <TouchableOpacity
              style={styles.editLocationButton}
              onPress={() => {
                setShowLocationVerification(false);
                setTimeout(() => setShowMapPicker(true), 300);
              }}
            >
              <Ionicons name="pencil" size={20} color="#210059" />
              <Text style={styles.editLocationText}>Edit Location</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.confirmOrderButton, loading && styles.confirmOrderButtonDisabled]}
              onPress={confirmAndPlaceOrder}
              disabled={loading}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#FFF" />
                  <Text style={styles.confirmOrderText}>Processing...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  <Text style={styles.confirmOrderText}>Confirm & Place Order</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemLeft: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  orderItemPrice: {
    fontSize: 12,
    color: '#666',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 12,
    minWidth: 24,
    textAlign: 'center',
  },
  orderItemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 60,
    textAlign: 'right',
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
  inputContainerError: {
    borderColor: '#210059',
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    fontSize: 12,
    color: '#210059',
    marginTop: 4,
    marginLeft: 4,
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
    color: '#210059',
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
    backgroundColor: '#210059',
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
    backgroundColor: '#210059',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Map Picker Styles
  mapButton: {
    flexDirection: 'row',
    backgroundColor: '#210059',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  mapButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontFamily: 'monospace',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  mapHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  mapPickerContainer: {
    flex: 1,
    position: 'relative',
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    zIndex: 10,
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  mapAddressContainer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  mapAddressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  mapAddressTextContainer: {
    flex: 1,
  },
  mapAddressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  mapAddressText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  mapCoordinates: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  mapFooter: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  confirmLocationButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmLocationText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Location Verification Modal Styles
  verificationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E6F2FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  verificationNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#0066CC',
    lineHeight: 18,
  },
  editLocationButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#210059',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    gap: 6,
  },
  editLocationText: {
    color: '#210059',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmOrderButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmOrderButtonDisabled: {
    backgroundColor: '#A5D6A7',
    opacity: 0.6,
  },
  confirmOrderText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
