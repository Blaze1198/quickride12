import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  Switch,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

interface Order {
  id: string;
  restaurant_name: string;
  customer_name: string;
  total_amount: number;
  status: string;
  delivery_address: {
    address: string;
    latitude: number;
    longitude: number;
  };
  created_at: string;
}

interface Ride {
  id: string;
  customer_name: string;
  pickup_location: any;
  dropoff_location: any;
  distance_km: number;
  estimated_fare: number;
  status: string;
  created_at: string;
}

// Inner component with all hooks
function RiderAvailableContent() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();
  const [serviceType, setServiceType] = useState<'food_delivery' | 'ride_service'>('food_delivery');
  const [orders, setOrders] = useState<Order[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [nearbyOrders, setNearbyOrders] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationAddress, setLocationAddress] = useState('Fetching location...');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);

  // Auth and role checked in wrapper - this will only render for riders

  useEffect(() => {
    // Wait for auth to load and verify user is a rider before fetching
    if (authLoading || !user || user.role !== 'rider') {
      // Silently skip - layout will redirect if not authenticated
      return;
    }

    fetchData();
    fetchRiderAvailability();
    fetchRiderLocation();
    fetchNearbyOrders();
    fetchTotalEarnings();
    // Poll for new orders/rides and nearby orders
    const interval = setInterval(() => {
      fetchData();
      fetchNearbyOrders();
      fetchTotalEarnings();
    }, 10000);
    return () => clearInterval(interval);
  }, [serviceType, user, authLoading]);

  const fetchTotalEarnings = async () => {
    if (!user || user.role !== 'rider') return;

    try {
      const response = await api.get('/riders/me/earnings');
      setTotalEarnings(response.data.total_earnings || 0);
    } catch (error: any) {
      // Silently ignore auth errors (401/403) - user is not a rider
      if (error?.response?.status === 401 || error?.response?.status === 403) return;
      console.error('Error fetching earnings:', error);
    }
  };

  const fetchRiderAvailability = async () => {
    // Guard: Only fetch if user is a rider
    if (!user || user.role !== 'rider') {
      return;
    }

    try {
      const response = await api.get('/riders/me');
      setIsAvailable(response.data.is_available !== false);
    } catch (error: any) {
      // Silently fail if unauthorized (user not logged in or not a rider)
      if (error?.response?.status === 401) return;
      console.error('Error fetching rider availability:', error);
    }
  };

  const fetchRiderLocation = async () => {
    // Guard: Only fetch if user is a rider
    if (!user || user.role !== 'rider') {
      return;
    }

    try {
      const response = await api.get('/riders/me');
      if (response.data.current_location) {
        setCurrentLocation(response.data.current_location);
        setLocationAddress(response.data.current_location.address || 'Location set');
      }
    } catch (error: any) {
      // Silently fail if unauthorized
      if (error?.response?.status === 401) return;
      console.error('Error fetching rider location:', error);
    }
  };

  const getCurrentGPSLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          await updateRiderLocation(location);
        },
        (error) => {
          console.error('Error getting GPS location:', error);
          if (Platform.OS === 'web') {
            window.alert('Failed to get GPS location. Please enable location permissions.');
          } else {
            Alert.alert('Error', 'Failed to get GPS location');
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      if (Platform.OS === 'web') {
        window.alert('Geolocation is not supported by your browser');
      } else {
        Alert.alert('Error', 'Geolocation not available');
      }
    }
  };

  const updateRiderLocation = async (location: any) => {
    try {
      // Reverse geocode to get address
      let address = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
      
      if (Platform.OS === 'web' && (window as any).google) {
        const google = (window as any).google;
        const geocoder = new google.maps.Geocoder();
        const result = await new Promise((resolve) => {
          geocoder.geocode(
            { location: { lat: location.latitude, lng: location.longitude } },
            (results: any, status: any) => {
              if (status === 'OK' && results[0]) {
                resolve(results[0].formatted_address);
              } else {
                resolve(address);
              }
            }
          );
        });
        address = result as string;
      }

      const locationData = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: address,
      };

      await api.put('/riders/location', locationData);
      setCurrentLocation(locationData);
      setLocationAddress(address);
      
      if (Platform.OS === 'web') {
        window.alert('✅ Location updated successfully!');
      } else {
        Alert.alert('Success', 'Location updated successfully!');
      }
      
      // Refresh nearby orders with new location
      fetchNearbyOrders();
    } catch (error: any) {
      console.error('Error updating location:', error);
      const message = error.response?.data?.detail || 'Failed to update location';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const fetchNearbyOrders = async () => {
    // Guard: Only fetch if user is a rider
    if (!user || user.role !== 'rider') {
      return;
    }

    try {
      const response = await api.get('/riders/nearby-orders?radius=10');
      setNearbyOrders(response.data.orders || []);
    } catch (error: any) {
      // Silently ignore auth errors (401/403) - user is not a rider
      if (error?.response?.status === 401 || error?.response?.status === 403) return;
      console.error('Error fetching nearby orders:', error);
    }
  };

  const toggleAvailability = async (value: boolean) => {
    try {
      await api.put('/riders/availability', { is_available: value });
      setIsAvailable(value);
      if (Platform.OS === 'web') {
        window.alert(value ? '✅ You are now available for deliveries' : '⚠️ You will not receive new orders');
      } else {
        Alert.alert('Status Updated', value ? '✅ You are now available for deliveries' : '⚠️ You will not receive new orders');
      }
    } catch (error: any) {
      console.error('Error toggling availability:', error);
      const message = error.response?.data?.detail || 'Failed to update availability';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    }
  };


  const loadGoogleMapsScript = () => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject('Not in browser environment');
        return;
      }

      if ((window as any).google && (window as any).google.maps) {
        resolve((window as any).google);
        return;
      }

      const script = document.createElement('script');
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDJqsXxZXuu808lFZXARvy4rd0xktuqwJQ';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if ((window as any).google) {
          resolve((window as any).google);
        } else {
          reject('Google Maps API failed to load');
        }
      };
      
      script.onerror = () => reject('Failed to load Google Maps script');
      document.head.appendChild(script);
    });
  };

  const searchLocation = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      if (Platform.OS === 'web') {
        // Ensure Google Maps is loaded
        const google = await loadGoogleMapsScript();
        
        const service = new google.maps.places.PlacesService(document.createElement('div'));
        
        const request = {
          query: query,
          fields: ['name', 'formatted_address', 'geometry'],
        };

        service.textSearch(request, (results: any, status: any) => {
          console.log('Search status:', status);
          console.log('Search results:', results);
          
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setSearchResults(results.slice(0, 5)); // Top 5 results
            setSearching(false);
          } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            setSearchResults([]);
            setSearching(false);
          } else {
            console.error('Places API error:', status);
            setSearchResults([]);
            setSearching(false);
            
            if (Platform.OS === 'web') {
              window.alert(`Search error: ${status}. Please ensure Google Places API is enabled.`);
            }
          }
        });
      } else {
        setSearching(false);
      }
    } catch (error) {
      console.error('Error searching location:', error);
      setSearching(false);
      
      if (Platform.OS === 'web') {
        window.alert('Failed to load Google Maps. Please check your internet connection.');
      }
    }
  };

  const selectSearchResult = async (place: any) => {
    const location = {
      latitude: place.geometry.location.lat(),
      longitude: place.geometry.location.lng(),
    };
    
    await updateRiderLocation(location);
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const fetchData = async () => {
    // Guard: Only fetch if user is a rider
    if (!user || user.role !== 'rider') {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (serviceType === 'food_delivery') {
        const response = await api.get('/orders');
        setOrders(response.data);
      } else {
        const response = await api.get('/rider/rides/available');
        setRides(response.data);
      }
    } catch (error: any) {
      // Silently fail if unauthorized
      if (error?.response?.status === 401) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleService = async (toRideService?: boolean) => {
    let newService: 'food_delivery' | 'ride_service';
    
    if (typeof toRideService === 'boolean') {
      // Called from TouchableOpacity with explicit service type
      newService = toRideService ? 'ride_service' : 'food_delivery';
    } else {
      // Called from Switch (legacy) - toggle between services
      newService = serviceType === 'food_delivery' ? 'ride_service' : 'food_delivery';
    }
    
    // Don't switch if already on the target service
    if (newService === serviceType) return;
    
    setToggling(true);
    try {
      await api.put('/rider/toggle-service', { service_type: newService });
      setServiceType(newService);
      setLoading(true);
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to switch service');
    } finally {
      setToggling(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const acceptRide = async (rideId: string) => {
    try {
      await api.put(`/rider/rides/${rideId}/accept`, {});
      Alert.alert('Success', 'Ride accepted! Navigate to pickup location.');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to accept ride');
    }
  };

  const handlePickup = async (orderId: string) => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('Mark this order as picked up?')
      : await new Promise((resolve) => {
          Alert.alert('Pickup Confirmation', 'Mark this order as picked up?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Confirm', onPress: () => resolve(true) },
          ]);
        });

    if (!confirmed) return;
    try {
      await api.put(`/orders/${orderId}/status`, { status: 'out_for_delivery' });
      console.log('Order marked as out for delivery');
      
      if (Platform.OS === 'web') {
        window.alert('Order picked up! Now out for delivery.');
      } else {
        Alert.alert('Success', 'Order picked up! Now out for delivery.');
      }
      
      fetchOrders();
    } catch (error: any) {
      console.error('Error marking pickup:', error);
      console.error('Error response:', error.response?.data);
      
      const message = error.response?.data?.detail || 'Failed to mark as picked up. Please try again.';
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleDeliver = async (orderId: string) => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('Mark this order as delivered?')
      : await new Promise((resolve) => {
          Alert.alert('Delivery Confirmation', 'Mark this order as delivered?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Confirm', onPress: () => resolve(true) },
          ]);
        });

    if (!confirmed) return;

    try {
      await api.put(`/orders/${orderId}/status`, { status: 'delivered' });
      
      if (Platform.OS === 'web') {
        window.alert('Order delivered successfully!');
      } else {
        Alert.alert('Success', 'Order delivered successfully!');
      }
      
      fetchOrders();
    } catch (error: any) {
      console.error('Error marking delivery:', error);
      
      const message = error.response?.data?.detail || 'Failed to mark as delivered.';
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const renderRide = ({ item }: { item: Ride }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.restaurantInfo}>
          <Ionicons name="bicycle" size={24} color="#2196F3" />
          <View style={styles.restaurantDetails}>
            <Text style={styles.restaurantName}>Ride Request</Text>
            <Text style={styles.customerName}>{item.customer_name}</Text>
          </View>
        </View>
        <Text style={styles.amount}>₱{item.estimated_fare.toFixed(2)}</Text>
      </View>

      <View style={styles.addressContainer}>
        <Ionicons name="location" size={20} color="#4CAF50" />
        <Text style={styles.address} numberOfLines={1}>
          From: {item.pickup_location.address}
        </Text>
      </View>
      
      <View style={styles.addressContainer}>
        <Ionicons name="location" size={20} color="#F44336" />
        <Text style={styles.address} numberOfLines={1}>
          To: {item.dropoff_location.address}
        </Text>
      </View>

      <View style={styles.rideInfo}>
        <Text style={styles.rideDistance}>{item.distance_km} km</Text>
      </View>

      <TouchableOpacity
        style={styles.acceptRideButton}
        onPress={() => acceptRide(item.id)}
      >
        <Ionicons name="checkmark-circle" size={24} color="#FFF" />
        <Text style={styles.acceptRideButtonText}>Accept Ride</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.restaurantInfo}>
          <Ionicons name="restaurant" size={24} color="#210059" />
          <View style={styles.restaurantDetails}>
            <Text style={styles.restaurantName}>{item.restaurant_name}</Text>
            <Text style={styles.customerName}>Deliver to: {item.customer_name}</Text>
          </View>
        </View>
        <Text style={styles.amount}>₱{item.total_amount.toFixed(2)}</Text>
      </View>

      <View style={styles.addressContainer}>
        <Ionicons name="location" size={20} color="#666" />
        <Text style={styles.address} numberOfLines={2}>
          {item.delivery_address.address}
        </Text>
      </View>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          {item.status === 'rider_assigned' ? 'ASSIGNED - Ready for Pickup' :
           item.status === 'out_for_delivery' ? 'OUT FOR DELIVERY 🚴' :
           item.status}
        </Text>
      </View>

      {/* Start Navigation Button - Always visible for assigned orders */}
      {(item.status === 'rider_assigned' || item.status === 'out_for_delivery') && (
        <TouchableOpacity
          style={styles.navigationButton}
          onPress={() => router.push('/(rider)/navigation')}
        >
          <Ionicons name="navigate" size={24} color="#FFF" />
          <Text style={styles.navigationButtonText}>Start Navigation</Text>
        </TouchableOpacity>
      )}

      {item.status === 'rider_assigned' && (
        <TouchableOpacity
          style={styles.pickupButton}
          onPress={() => handlePickup(item.id)}
        >
          <Ionicons name="cube" size={24} color="#FFF" />
          <Text style={styles.pickupButtonText}>Mark as Picked Up</Text>
        </TouchableOpacity>
      )}

      {item.status === 'out_for_delivery' && (
        <TouchableOpacity
          style={styles.deliverButton}
          onPress={() => handleDeliver(item.id)}
        >
          <Ionicons name="checkmark-done-circle" size={24} color="#FFF" />
          <Text style={styles.deliverButtonText}>Mark as Delivered</Text>
        </TouchableOpacity>
      )}
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
      {/* Total Earnings Card - Compact */}
      <View style={styles.earningsCard}>
        <View style={styles.earningsHeader}>
          <Ionicons name="wallet" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <View>
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <Text style={styles.earningsAmount}>₱{totalEarnings.toFixed(2)}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.viewDetailsButton}
          onPress={() => router.push('/(rider)/earnings' as any)}
        >
          <Text style={styles.viewDetailsText}>Details</Text>
          <Ionicons name="chevron-forward" size={14} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Compact Status Header */}
      <View style={styles.compactHeader}>
        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <Ionicons 
              name={isAvailable ? "checkmark-circle" : "close-circle"} 
              size={20} 
              color={isAvailable ? "#4CAF50" : "#210059"} 
            />
            <Text style={styles.statusText}>
              {isAvailable ? 'Available' : 'Offline'}
            </Text>
            <Switch
              value={isAvailable}
              onValueChange={toggleAvailability}
              trackColor={{ false: '#FFE0E0', true: '#C8E6C9' }}
              thumbColor={isAvailable ? '#4CAF50' : '#210059'}
              ios_backgroundColor="#FFE0E0"
              style={{ transform: [{ scale: 0.8 }] }}
            />
          </View>

          {isAvailable && nearbyOrders.length > 0 && (
            <View style={styles.nearbyBadge}>
              <Ionicons name="location" size={16} color="#2196F3" />
              <Text style={styles.nearbyText}>{nearbyOrders.length} nearby</Text>
            </View>
          )}
        </View>

        {/* Service Type Toggle - Compact */}
        <View style={styles.serviceToggle}>
          <TouchableOpacity
            style={[styles.serviceTab, serviceType === 'food_delivery' && styles.serviceTabActive]}
            onPress={() => !toggling && toggleService(false)}
          >
            <Ionicons 
              name="fast-food" 
              size={20} 
              color={serviceType === 'food_delivery' ? '#FFF' : '#999'} 
            />
            <Text style={[
              styles.serviceTabText,
              serviceType === 'food_delivery' && styles.serviceTabTextActive
            ]}>
              Food
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.serviceTab, serviceType === 'ride_service' && styles.serviceTabActive]}
            onPress={() => !toggling && toggleService(true)}
          >
            <Ionicons 
              name="bicycle" 
              size={20} 
              color={serviceType === 'ride_service' ? '#FFF' : '#999'} 
            />
            <Text style={[
              styles.serviceTabText,
              serviceType === 'ride_service' && styles.serviceTabTextActive
            ]}>
              Ride
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {serviceType === 'food_delivery' ? (
        <FlatList
          data={orders.filter((o) => o.status === 'rider_assigned' || o.status === 'out_for_delivery')}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#210059']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>No available food deliveries</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={rides}
          renderItem={renderRide}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196F3']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bicycle-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>No available ride requests</Text>
            </View>
          }
        />
      )}

      {/* Search Location Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalContent}>
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>Search Location</Text>
              <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a place..."
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchLocation(text);
                }}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.searchResultsContainer}>
              {searching && (
                <View style={styles.searchLoadingContainer}>
                  <ActivityIndicator size="small" color="#210059" />
                  <Text style={styles.searchLoadingText}>Searching...</Text>
                </View>
              )}

              {!searching && searchResults.length === 0 && searchQuery.length >= 3 && (
                <View style={styles.noResultsContainer}>
                  <Ionicons name="location-outline" size={48} color="#CCC" />
                  <Text style={styles.noResultsText}>No locations found</Text>
                  <Text style={styles.noResultsSubtext}>Try a different search term</Text>
                </View>
              )}

              {!searching && searchResults.length === 0 && searchQuery.length < 3 && (
                <View style={styles.noResultsContainer}>
                  <Ionicons name="search-outline" size={48} color="#CCC" />
                  <Text style={styles.noResultsText}>Start typing to search</Text>
                  <Text style={styles.noResultsSubtext}>Enter at least 3 characters</Text>
                </View>
              )}

              {searchResults.map((place, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.searchResultItem}
                  onPress={() => selectSearchResult(place)}
                >
                  <Ionicons name="location" size={24} color="#210059" />
                  <View style={styles.searchResultText}>
                    <Text style={styles.searchResultName}>{place.name}</Text>
                    <Text style={styles.searchResultAddress} numberOfLines={2}>
                      {place.formatted_address}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#CCC" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Wrapper component to prevent hooks violation
export default function RiderAvailableScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#210059" />
        </View>
      </SafeAreaView>
    );
  }

  if (user && user.role !== 'rider') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed" size={80} color="#210059" />
          <Text style={styles.emptyText}>Access Restricted</Text>
          <Text style={styles.emptySubtext}>This screen is only accessible to riders</Text>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.actionButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <RiderAvailableContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  toggleHeader: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#333',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  restaurantInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  restaurantDetails: {
    marginLeft: 12,
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: '#666',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#210059',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 16,
  },
  address: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#F0F0F0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#210059',
  },
  navigationButton: {
    flexDirection: 'row',
    backgroundColor: '#9C27B0',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  navigationButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  pickupButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deliverButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  rideInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  rideDistance: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  acceptRideButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptRideButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  acceptButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  availabilityCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  availabilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availabilityTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  availabilityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  availabilitySubtext: {
    fontSize: 12,
    color: '#666',
  },
  nearbyInfoCard: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nearbyInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  nearbyInfoSubtext: {
    fontSize: 12,
    color: '#1976D2',
    marginLeft: 'auto',
  },
  locationCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  locationIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  locationDropdownButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  locationCoords: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  locationDropdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  locationOptionText: {
    flex: 1,
  },
  locationOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  locationOptionSubtext: {
    fontSize: 12,
    color: '#999',
  },
  locationDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  searchModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    paddingTop: 20,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    outlineStyle: 'none',
  },
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  searchLoadingText: {
    fontSize: 14,
    color: '#999',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 4,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 12,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  searchResultAddress: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  // Earnings Card Styles - Compact
  earningsCard: {
    backgroundColor: '#4CAF50',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  earningsHeader: {
    flex: 1,
  },
  earningsLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
    fontWeight: '500',
  },
  earningsAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
    marginRight: 2,
  },
  // Compact Header Styles
  compactHeader: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  nearbyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  nearbyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  serviceToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 2,
  },
  serviceTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  serviceTabActive: {
    backgroundColor: '#210059',
  },
  serviceTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  serviceTabTextActive: {
    color: '#FFF',
  },
});
