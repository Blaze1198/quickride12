import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import api from '../utils/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Order {
  id: string;
  restaurant_name: string;
  restaurant_location?: {
    latitude: number;
    longitude: number;
  };
  status: string;
  total_amount: number;
  delivery_address: any;
  rider_name?: string;
  rider_phone?: string;
  items: any[];
  created_at: string;
}

export default function LiveOrderTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null); // Track if map is already initialized
  const initializedOrderIdRef = useRef<string | null>(null); // Track initialized order ID
  const bottomSheetRef = useRef<BottomSheet>(null); // Bottom sheet control
  const riderMarkerRef = useRef<any>(null); // Track rider marker for updates
  const directionsRenderersRef = useRef<any[]>([]); // Store multiple route renderers
  const routePolylineRef = useRef<any>(null); // Track route polyline for updates
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['20%', '50%', '90%'], []);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [riderLocation, setRiderLocation] = useState<any>(null);
  const [distance, setDistance] = useState<string>('');
  const [eta, setEta] = useState<string>('');
  const [mapError, setMapError] = useState<string>('');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState(35);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
      fetchRiderLocation();
      // Auto-refresh every 3 seconds for real-time updates
      const interval = setInterval(() => {
        fetchOrder();
        fetchRiderLocation();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [orderId]);

  // Initialize map once when order is loaded (rider location is optional)
  useEffect(() => {
    if (order && Platform.OS === 'web') {
      // Only initialize map if it hasn't been initialized yet or order changed
      if (!mapInstanceRef.current || initializedOrderIdRef.current !== order.id) {
        console.log('🗺️ Initializing map for order:', order.id, 'Rider location:', riderLocation ? 'available' : 'not yet available');
        initializedOrderIdRef.current = order.id;
        loadMap();
      } else {
        console.log('⏭️ Skipping map re-initialization for order:', order.id);
        // Update markers without re-initializing map
        updateMapMarkers();
      }
    }
  }, [order?.id, riderLocation]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setOrder(response.data);
      calculateEstimatedTime(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching order:', error);
      setLoading(false);
    }
  };

  const calculateEstimatedTime = (orderData: Order) => {
    if (!orderData) return;
    
    // Base preparation time: 15-20 minutes
    const prepTime = 15 + Math.floor(Math.random() * 6);
    
    // Additional time based on number of items (1 min per 2 items)
    const itemsTime = Math.ceil(orderData.items.length / 2);
    
    // Delivery time: 10-15 minutes
    const deliveryTime = 10 + Math.floor(Math.random() * 6);
    
    // Reduce time based on order status
    let statusReduction = 0;
    if (orderData.status === 'confirmed' || orderData.status === 'ready_for_pickup') {
      statusReduction = 5; // Already preparing
    } else if (orderData.status === 'rider_assigned' || orderData.status === 'picked_up') {
      statusReduction = 15; // Past preparation, only delivery left
    } else if (orderData.status === 'out_for_delivery') {
      statusReduction = 20; // Just delivery time remaining
    }
    
    const total = Math.max(5, prepTime + itemsTime + deliveryTime - statusReduction);
    setEstimatedMinutes(total);
  };

  const fetchRiderLocation = async () => {
    try {
      const response = await api.get(`/orders/${orderId}/rider-location`);
      console.log('📍 API Response - Rider Location:', response.data);
      if (response.data.rider_assigned && response.data.location) {
        console.log('✅ Setting rider location:', response.data.location);
        console.log('   Lat:', response.data.location.latitude, 'Lng:', response.data.location.longitude);
        setRiderLocation(response.data.location);
        // Calculate distance and ETA if we have both locations
        if (order?.delivery_address && response.data.location) {
          calculateDistanceAndETA(response.data.location, order.delivery_address);
        }
      } else {
        console.log('⚠️ No rider location available yet');
      }
    } catch (error) {
      console.error('❌ Error fetching rider location:', error);
    }
  };

  const calculateDistanceAndETA = (from: any, to: any) => {
    // Calculate straight-line distance (Haversine formula)
    const R = 6371; // Radius of Earth in km
    const dLat = (to.latitude - from.latitude) * Math.PI / 180;
    const dLon = (to.longitude - from.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(from.latitude * Math.PI / 180) * Math.cos(to.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    
    if (distanceKm < 1) {
      setDistance(`${(distanceKm * 1000).toFixed(0)}m away`);
    } else {
      setDistance(`${distanceKm.toFixed(1)}km away`);
    }
    
    // Estimate ETA (assuming 20 km/h average speed in city)
    const etaMinutes = Math.ceil((distanceKm / 20) * 60);
    setEta(`${etaMinutes} min`);
  };

  const loadMap = () => {
    if (typeof window === 'undefined' || !order) {
      console.log('Map load conditions not met:', {
        hasWindow: typeof window !== 'undefined',
        hasOrder: !!order
      });
      return;
    }

    // If Google Maps is already loaded, initialize immediately
    if ((window as any).google && (window as any).google.maps) {
      console.log('✅ Google Maps already available, initializing...');
      initializeMap();
      return;
    }

    // Prevent loading script multiple times
    if (scriptLoaded) {
      console.log('Script already loading...');
      return;
    }

    setScriptLoaded(true);
    console.log('🔄 Starting to load Google Maps script...');

    const apiKey = 'AIzaSyA0m1oRlXLQWjxacqjEJ6zJW3WvmOWvQkQ';
    
    // Check if script already exists in DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('Script tag exists, waiting for load...');
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if ((window as any).google && (window as any).google.maps) {
          clearInterval(checkInterval);
          console.log('✅ Google Maps loaded from existing script');
          initializeMap();
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!mapLoaded) {
          console.error('❌ Timeout waiting for Google Maps');
          setMapError('Map failed to load. Please refresh the page.');
          setScriptLoaded(false);
        }
      }, 10000);
      return;
    }

    // Create new script tag with geometry library for route calculations
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('✅ Google Maps script loaded successfully');
      // Wait a bit for google.maps to be fully available
      setTimeout(() => {
        if ((window as any).google && (window as any).google.maps) {
          console.log('✅ Google Maps API is ready');
          initializeMap();
        } else {
          console.error('❌ Google Maps API not available after script load');
          setMapError('Map API failed to initialize');
          setScriptLoaded(false);
        }
      }, 100);
    };
    
    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps script:', error);
      setMapError('Failed to load map. Please check your connection.');
      setScriptLoaded(false);
    };
    
    document.head.appendChild(script);
    console.log('📍 Google Maps script tag added to document');

    // Safety timeout - if map doesn't load in 10 seconds, show error
    setTimeout(() => {
      if (!mapLoaded) {
        console.error('❌ Map loading timeout (10s)');
        setMapError('Map took too long to load. Please refresh the page.');
        setScriptLoaded(false);
      }
    }, 10000);
  };

  const initializeMap = () => {
    const google = (window as any).google;
    if (!google) {
      console.error('❌ Google Maps API not available after script load');
      setMapLoaded(false);
      return;
    }
    if (!mapRef.current) {
      console.error('❌ Map container ref not available');
      return;
    }
    if (!order) {
      console.error('❌ No order data available for map');
      return;
    }

    console.log('✅ Initializing map for order tracking');

    // Default to delivery address
    const center = {
      lat: order.delivery_address?.latitude || 14.5995,
      lng: order.delivery_address?.longitude || 120.9842,
    };

    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 15,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    // Store map instance to prevent re-initialization
    mapInstanceRef.current = map;
    setMapLoaded(true);
    console.log('✅ Map initialized successfully');
    console.log('📍 Rider location available?', riderLocation ? 'Yes' : 'No');

    // Create location pin icon (matching rider's navigation - NO TEXT NODES)
    const createLocationPinIcon = (color: string, iconType: string) => {
      // Use simple circle icon instead of emoji to avoid text node errors
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="60" viewBox="0 0 50 60">
          <defs>
            <filter id="shadow-${color.replace('#', '')}" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.4"/>
            </filter>
          </defs>
          <path d="M 25 5 C 15 5 7 13 7 23 C 7 33 25 50 25 50 C 25 50 43 33 43 23 C 43 13 35 5 25 5 Z" 
                fill="${color}" 
                stroke="white" 
                stroke-width="2" 
                filter="url(#shadow-${color.replace('#', '')})"/>
          <circle cx="25" cy="23" r="12" fill="white"/>
          <circle cx="25" cy="23" r="8" fill="${color}"/>
        </svg>
      `;
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    };

    // Restaurant location marker (Red location pin) - if order has restaurant
    let restaurantLocation = null;
    if (order.restaurant_location) {
      restaurantLocation = {
        lat: order.restaurant_location.latitude,
        lng: order.restaurant_location.longitude,
      };
      
      const restaurantMarker = new google.maps.Marker({
        position: restaurantLocation,
        map,
        icon: {
          url: createLocationPinIcon('#EA4335', 'restaurant'),
          scaledSize: new google.maps.Size(50, 60),
          anchor: new google.maps.Point(25, 55),
        },
        title: `Restaurant: ${order.restaurant_name}`,
        zIndex: 900,
        animation: google.maps.Animation.BOUNCE,
      });
      
      // Stop bouncing after 2 seconds
      setTimeout(() => {
        restaurantMarker.setAnimation(null);
      }, 2000);
    }

    // Delivery location marker (Customer - Green location pin)
    let customerLocation = null;
    if (order.delivery_address) {
      customerLocation = {
        lat: order.delivery_address.latitude,
        lng: order.delivery_address.longitude,
      };
      
      const customerMarker = new google.maps.Marker({
        position: customerLocation,
        map,
        icon: {
          url: createLocationPinIcon('#34A853', 'customer'),
          scaledSize: new google.maps.Size(50, 60),
          anchor: new google.maps.Point(25, 55),
        },
        title: 'Your Location',
        zIndex: 800,
        animation: google.maps.Animation.BOUNCE,
      });
      
      // Stop bouncing after 2 seconds
      setTimeout(() => {
        customerMarker.setAnimation(null);
      }, 2000);
    }

    // Create arrow icon for rider marker (NO TEXT NODES to prevent React errors)
    const createRiderArrowIcon = () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><defs><filter id="shadow-rider" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter></defs><circle cx="20" cy="20" r="18" fill="#4285F4" filter="url(#shadow-rider)"/><path d="M 20 8 L 27 25 L 20 22 L 13 25 Z" fill="white"/></svg>`;
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    };

    // Rider marker (Real-time location - Blue arrow icon, not red pin!)
    if (riderLocation) {
      console.log('🎯 Creating rider marker with BLUE ARROW icon');
      riderMarkerRef.current = new google.maps.Marker({
        position: {
          lat: riderLocation.latitude,
          lng: riderLocation.longitude,
        },
        map,
        icon: {
          url: createRiderArrowIcon(),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 20),
        },
        title: `Rider: ${order.rider_name || 'On the way'}`,
        zIndex: 1000,
      });

      // Draw DUAL ROUTES like rider's navigation screen
      const drawDualRoutes = async () => {
        try {
          const apiKey = 'AIzaSyA0m1oRlXLQWjxacqjEJ6zJW3WvmOWvQkQ';
          
          // If we have restaurant location, draw BOTH routes
          if (restaurantLocation && customerLocation) {
            console.log('🗺️ Drawing dual routes: Rider→Restaurant (BLUE) and Restaurant→Customer (GREEN)');
            
            // ROUTE 1: Rider → Restaurant (BLUE)
            const route1Response = await fetch(
              `https://routes.googleapis.com/directions/v2:computeRoutes`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': apiKey,
                  'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
                },
                body: JSON.stringify({
                  origin: {
                    location: {
                      latLng: {
                        latitude: riderLocation.latitude,
                        longitude: riderLocation.longitude
                      }
                    }
                  },
                  destination: {
                    location: {
                      latLng: {
                        latitude: restaurantLocation.lat,
                        longitude: restaurantLocation.lng
                      }
                    }
                  },
                  travelMode: 'DRIVE',
                  routingPreference: 'TRAFFIC_AWARE',
                  computeAlternativeRoutes: false,
                  languageCode: 'en-US',
                  units: 'METRIC'
                })
              }
            );

            if (route1Response.ok) {
              const data1 = await route1Response.json();
              if (data1.routes && data1.routes.length > 0) {
                const route1 = data1.routes[0];
                const path1 = google.maps.geometry.encoding.decodePath(route1.polyline.encodedPolyline);
                
                const polyline1 = new google.maps.Polyline({
                  path: path1,
                  geodesic: true,
                  strokeColor: '#4285F4', // Blue for rider → restaurant
                  strokeOpacity: 0.8,
                  strokeWeight: 6,
                  map: map,
                  zIndex: 100,
                });
                
                directionsRenderersRef.current.push(polyline1);
                console.log('✅ Route 1 (Rider→Restaurant) drawn in BLUE');
                
                // Update ETA based on first route
                const distanceKm = (route1.distanceMeters / 1000).toFixed(1);
                const durationMin = Math.ceil(parseInt(route1.duration.replace('s', '')) / 60);
                setDistance(`${distanceKm} km`);
                setEta(`${durationMin} min`);
              }
            }

            // ROUTE 2: Restaurant → Customer (GREEN)
            const route2Response = await fetch(
              `https://routes.googleapis.com/directions/v2:computeRoutes`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': apiKey,
                  'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
                },
                body: JSON.stringify({
                  origin: {
                    location: {
                      latLng: {
                        latitude: restaurantLocation.lat,
                        longitude: restaurantLocation.lng
                      }
                    }
                  },
                  destination: {
                    location: {
                      latLng: {
                        latitude: customerLocation.lat,
                        longitude: customerLocation.lng
                      }
                    }
                  },
                  travelMode: 'DRIVE',
                  routingPreference: 'TRAFFIC_AWARE',
                  computeAlternativeRoutes: false,
                  languageCode: 'en-US',
                  units: 'METRIC'
                })
              }
            );

            if (route2Response.ok) {
              const data2 = await route2Response.json();
              if (data2.routes && data2.routes.length > 0) {
                const route2 = data2.routes[0];
                const path2 = google.maps.geometry.encoding.decodePath(route2.polyline.encodedPolyline);
                
                const polyline2 = new google.maps.Polyline({
                  path: path2,
                  geodesic: true,
                  strokeColor: '#34A853', // Green for restaurant → customer
                  strokeOpacity: 0.8,
                  strokeWeight: 6,
                  map: map,
                  zIndex: 99,
                });
                
                directionsRenderersRef.current.push(polyline2);
                console.log('✅ Route 2 (Restaurant→Customer) drawn in GREEN');
              }
            }
            
            // Fit bounds to show all three points
            const bounds = new google.maps.LatLngBounds();
            bounds.extend({ lat: riderLocation.latitude, lng: riderLocation.longitude });
            bounds.extend(restaurantLocation);
            bounds.extend(customerLocation);
            map.fitBounds(bounds);
            
          } else if (customerLocation) {
            // Fallback: Single route from rider to customer
            console.log('🗺️ Drawing single route: Rider→Customer (BLUE)');
            
            const response = await fetch(
              `https://routes.googleapis.com/directions/v2:computeRoutes`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': apiKey,
                  'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
                },
                body: JSON.stringify({
                  origin: {
                    location: {
                      latLng: {
                        latitude: riderLocation.latitude,
                        longitude: riderLocation.longitude
                      }
                    }
                  },
                  destination: {
                    location: {
                      latLng: {
                        latitude: customerLocation.lat,
                        longitude: customerLocation.lng
                      }
                    }
                  },
                  travelMode: 'DRIVE',
                  routingPreference: 'TRAFFIC_AWARE',
                  computeAlternativeRoutes: false,
                  languageCode: 'en-US',
                  units: 'METRIC'
                })
              }
            );

            if (response.ok) {
              const data = await response.json();
              if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const path = google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
                
                routePolylineRef.current = new google.maps.Polyline({
                  path: path,
                  geodesic: true,
                  strokeColor: '#2196F3',
                  strokeOpacity: 0.8,
                  strokeWeight: 4,
                  map: map
                });

                const distanceKm = (route.distanceMeters / 1000).toFixed(1);
                const durationMin = Math.ceil(parseInt(route.duration.replace('s', '')) / 60);
                setDistance(`${distanceKm} km`);
                setEta(`${durationMin} min`);
                
                console.log(`📍 Single route: ${distanceKm}km, ETA: ${durationMin}min`);
              }
            }

            // Fit bounds to show both markers
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(customerLocation);
            bounds.extend({ lat: riderLocation.latitude, lng: riderLocation.longitude });
            map.fitBounds(bounds);
          }
        } catch (error) {
          console.error('❌ Error drawing routes:', error);
        }
      };

      drawDualRoutes();
    } else {
      // No rider assigned yet - just show restaurant and customer locations
      console.log('⏳ No rider assigned yet. Showing restaurant and customer locations only.');
      
      // Fit map bounds to show available markers
      const bounds = new google.maps.LatLngBounds();
      if (customerLocation) {
        bounds.extend(customerLocation);
      }
      if (restaurantLocation) {
        bounds.extend(restaurantLocation);
      }
      
      // Only fit bounds if we have at least one location
      if (customerLocation || restaurantLocation) {
        map.fitBounds(bounds);
        console.log('✅ Map bounds set to show available locations');
      }
    }
  };

  // Update map with new rider location (only update position, don't redraw routes constantly)
  const updateMapMarkers = async () => {
    console.log('🔄 Updating rider marker position');
    
    if (!riderLocation || !order || !mapInstanceRef.current) {
      console.log('⚠️ Cannot update - missing data');
      return;
    }

    const google = (window as any).google;
    if (!google || !google.maps) {
      console.log('⚠️ Google Maps not available');
      return;
    }

    // Just update the marker position - don't recreate it constantly
    if (riderMarkerRef.current) {
      const newPosition = {
        lat: riderLocation.latitude,
        lng: riderLocation.longitude,
      };
      riderMarkerRef.current.setPosition(newPosition);
      console.log('✅ Rider position updated to:', newPosition);
    }
    
    // Don't redraw routes every update - they're already drawn in initializeMap
    // Only update if we need to (e.g., when restaurant or customer location changes)

    // Routes are already drawn in initializeMap - no need to redraw constantly
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: string }> = {
      pending: { label: 'Order Received', color: '#FF9800', icon: 'time' },
      paid: { label: 'Payment Confirmed', color: '#2196F3', icon: 'checkmark-circle' },
      accepted: { label: 'Restaurant Accepted', color: '#9C27B0', icon: 'restaurant' },
      preparing: { label: 'Preparing Your Food', color: '#210059', icon: 'flame' },
      ready_for_pickup: { label: 'Ready for Pickup', color: '#FF9800', icon: 'cube' },
      rider_assigned: { label: 'Rider Assigned', color: '#00BCD4', icon: 'bicycle' },
      picked_up: { label: 'Picked Up', color: '#3F51B5', icon: 'bag-check' },
      out_for_delivery: { label: 'On the Way', color: '#2196F3', icon: 'navigate' },
      delivered: { label: 'Delivered', color: '#4CAF50', icon: 'checkmark-done' },
      cancelled: { label: 'Cancelled', color: '#F44336', icon: 'close-circle' },
    };
    return statusMap[status] || { label: status, color: '#999', icon: 'help' };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#210059" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#F44336" />
          <Text style={styles.errorText}>Order not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusInfo(order.status);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {Platform.OS === 'web' ? (
          <View style={styles.fullScreenMap}>
            {!mapLoaded && !mapError && (
              <View style={styles.mapLoadingOverlay}>
                <ActivityIndicator size="large" color="#210059" />
                <Text style={styles.mapLoadingText}>Loading map...</Text>
              </View>
            )}
            {mapError && (
              <View style={styles.mapLoadingOverlay}>
                <Ionicons name="alert-circle" size={48} color="#210059" />
                <Text style={styles.errorText}>{mapError}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => {
                    setMapError('');
                    setScriptLoaded(false);
                    setMapLoaded(false);
                    loadMap();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
            {Platform.OS === 'web' && (
              <View style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',opacity:mapLoaded?1:0}}><div ref={mapRef} style={{width:'100%',height:'100%'}}/></View>
            )}
          </View>
        ) : (
          <View style={[styles.fullScreenMap, styles.mapPlaceholder]}>
            <Ionicons name="map" size={64} color="#CCC" />
            <Text style={styles.mapPlaceholderText}>Map available on web</Text>
          </View>
        )}
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={[styles.backButtonOverlay, { top: insets.top + 10 }]}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.timeCard}>
          <Text style={styles.timeCardText}>
            {estimatedMinutes - 5} — {estimatedMinutes + 5} mins
          </Text>
        </View>
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose={false}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
        >
          <BottomSheetScrollView style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetTimeCard}>
              <Text style={styles.bottomSheetTimeText}>
                {estimatedMinutes - 5} — {estimatedMinutes + 5} mins
              </Text>
            </View>
            <View style={styles.minimizedSection}>
              <View style={styles.minimizedRow}>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                  <Ionicons name={statusInfo.icon as any} size={20} color="#FFF" />
                </View>
                <View style={styles.minimizedInfo}>
                  <Text style={styles.minimizedStatus}>{statusInfo.label}</Text>
                  {riderLocation && distance && (
                    <View style={styles.minimizedETA}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.minimizedETAText}>
                        {distance} • {eta}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.pullUpHint}>↑ Pull up for details</Text>
            </View>
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Order Information</Text>
              
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Ionicons name="restaurant-outline" size={20} color="#666" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Restaurant</Text>
                    <Text style={styles.infoValue}>{order.restaurant_name}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="cash-outline" size={20} color="#666" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Total Amount</Text>
                    <Text style={styles.infoValue}>₱{order.total_amount.toFixed(2)}</Text>
                  </View>
                </View>

                {order.rider_name && (
                  <View style={styles.infoRow}>
                    <Ionicons name="bicycle-outline" size={20} color="#666" />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Rider</Text>
                      <Text style={styles.infoValue}>{order.rider_name}</Text>
                      {order.rider_phone && (
                        <Text style={styles.infoSubValue}>{order.rider_phone}</Text>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={20} color="#666" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Delivery Address</Text>
                    <Text style={styles.infoValue}>{order.delivery_address?.address}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Order Items</Text>
              <View style={styles.itemsCard}>
                {order.items.map((item: any, index: number) => (
                  <View key={index} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                      <Text style={styles.itemName}>{item.name}</Text>
                    </View>
                    <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </BottomSheetScrollView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  timeCard: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    zIndex: 10,
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
  timeCardText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#210059',
    textAlign: 'center',
  },
  fullScreenMap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  backButtonOverlay: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  bottomSheetBackground: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  bottomSheetIndicator: {
    backgroundColor: '#DDD',
    width: 40,
    height: 4,
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
  },
  minimizedSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  minimizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  minimizedInfo: {
    flex: 1,
  },
  minimizedStatus: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  minimizedETA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  minimizedETAText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  pullUpHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  detailsSection: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 16,
  },
  infoCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  infoSubValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  itemsCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#210059',
    marginRight: 8,
    minWidth: 30,
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  mapContainer: {
    height: 300,
    backgroundColor: '#E0E0E0',
    position: 'relative',
  },
  mapPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#210059',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#210059',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusIndicator: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  distanceText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  detailsCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#F44336',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#210059',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#210059',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
