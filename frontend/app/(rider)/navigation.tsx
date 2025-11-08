import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import api from '../../utils/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function RiderNavigationScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null); // Track if map is already initialized
  const currentJobIdRef = useRef<string | null>(null); // Track current job ID
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  // ALL HOOKS AT THE TOP
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['12%', '50%', '90%'], []); // More minimal first snap point
  
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [distanceToDestination, setDistanceToDestination] = useState<string>('');
  const [etaToDestination, setEtaToDestination] = useState<string>('');
  const [mapError, setMapError] = useState<string>('');
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    fetchCurrentJob();
    getUserLocation();
    
    // Refresh job every 10 seconds
    const jobInterval = setInterval(() => {
      fetchCurrentJob();
    }, 10000);
    
    // Update location every 5 seconds
    const locationInterval = setInterval(() => {
      getUserLocation();
    }, 5000);
    
    return () => {
      clearInterval(jobInterval);
      clearInterval(locationInterval);
    };
  }, []); // Empty dependency array - only run once on mount

  // Separate effect for sending location updates to backend
  useEffect(() => {
    if (!userLocation || !currentJob) return;
    
    updateRiderLocation();
    
    // Send location updates every 5 seconds
    const updateInterval = setInterval(() => {
      updateRiderLocation();
    }, 5000);
    
    return () => clearInterval(updateInterval);
  }, [currentJob?.id]); // Only re-run when job changes

  // Initialize map only once when job ID changes
  useEffect(() => {
    const jobId = currentJob?.data?.id;
    
    // Only load map if:
    // 1. We have a current job
    // 2. Platform is web
    // 3. Job ID has changed OR map hasn't been initialized yet
    if (currentJob && Platform.OS === 'web') {
      if (!mapInstanceRef.current || currentJobIdRef.current !== jobId) {
        console.log('🗺️ Job changed or first load, initializing map for job:', jobId);
        currentJobIdRef.current = jobId;
        loadMap();
      } else {
        console.log('⏭️ Skipping map re-initialization, same job ID:', jobId);
      }
    }
  }, [currentJob]); // Removed userLocation from dependencies to prevent map refresh

  const getUserLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserLocation(location);
        },
        (error) => {
          console.error('❌ Error getting location:', error);
          // Fallback to real location in Manila (Makati CBD)
          const fallbackLocation = {
            latitude: 14.5547,
            longitude: 121.0244,
          };
          console.log('⚠️ Using fallback location (Makati, Manila)');
          setUserLocation(fallbackLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      console.warn('⚠️ Geolocation not available, using fallback');
      setUserLocation({
        latitude: 14.5547,
        longitude: 121.0244,
      });
    }
  };

  const updateRiderLocation = async () => {
    if (!userLocation) return;
    
    try {
      await api.put('/riders/location', {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        address: 'Current location',
      });
      console.log('Location updated:', userLocation);
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const fetchCurrentJob = async () => {
    try {
      // Try to get current order (food delivery)
      const orderResponse = await api.get('/rider/current-order');
      if (orderResponse.data) {
        setCurrentJob({ type: 'order', data: orderResponse.data });
        setLoading(false);
        return;
      }

      // Try to get current ride
      const rideResponse = await api.get('/rider/current-ride');
      if (rideResponse.data) {
        setCurrentJob({ type: 'ride', data: rideResponse.data });
        setLoading(false);
        return;
      }

      setCurrentJob(null);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching current job:', error);
      setLoading(false);
    }
  };

  const loadMap = () => {
    if (typeof window === 'undefined' || !currentJob || !userLocation) {
      console.log('Map load conditions not met:', {
        hasWindow: typeof window !== 'undefined',
        hasJob: !!currentJob,
        hasLocation: !!userLocation
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
    console.log('🔄 Starting to load Google Maps script for rider navigation...');

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

    // Create new script tag
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
      console.error('❌ Google Maps API not available');
      setMapLoaded(false);
      setMapError('Google Maps API not loaded');
      return;
    }
    if (!mapRef.current) {
      console.error('❌ Map container ref not available');
      setTimeout(() => initializeMap(), 200); // Retry
      return;
    }
    if (!currentJob) {
      console.error('❌ No current job available');
      setMapError('No active job found');
      return;
    }
    if (!userLocation) {
      console.error('❌ User location not available');
      setMapError('Unable to get your location');
      return;
    }

    console.log('✅ Initializing map with:', { 
      jobType: currentJob.type, 
      userLocation,
      jobData: currentJob.data 
    });

    // Helper function to safely parse coordinates
    const parseCoordinate = (value: any): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number' && !isNaN(value)) return value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value.trim());
        return isNaN(parsed) ? null : parsed;
      }
      console.warn('⚠️ Unexpected coordinate type:', typeof value, value);
      return null;
    };

    // Ensure userLocation has valid numeric coordinates
    const userLat = parseCoordinate(userLocation.latitude);
    const userLng = parseCoordinate(userLocation.longitude);
    
    if (userLat === null || userLng === null) {
      console.error('❌ Invalid user location coordinates:', userLocation);
      setMapError('Invalid location coordinates');
      return;
    }

    const userPosition = { lat: userLat, lng: userLng };
    console.log('✅ User position:', userPosition);

    try {
      const map = new google.maps.Map(mapRef.current, {
      center: userPosition,
      zoom: 14,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    // Store map instance in ref to prevent re-initialization
    mapInstanceRef.current = map;
    setMapLoaded(true);
    console.log('✅ Map initialized successfully');

    // Create custom SVG icons for better visibility
    const createIconUrl = (icon: string, color: string) => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="${color}" stroke="white" stroke-width="3"/>
          <text x="24" y="30" font-size="20" text-anchor="middle" fill="white">${icon}</text>
        </svg>
      `;
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    };

    // Current location marker (rider) - Motorcycle icon
    new google.maps.Marker({
      position: userPosition,
      map,
      icon: {
        url: createIconUrl('🏍️', '#2196F3'),
        scaledSize: new google.maps.Size(48, 48),
        anchor: new google.maps.Point(24, 24),
      },
      title: 'Your Location (Rider)',
      zIndex: 1000,
    });

    let pickupLocation, dropoffLocation;

    if (currentJob.type === 'order') {
      // Food delivery: Restaurant = pickup, Customer = dropoff
      const restaurantLocation = currentJob.data.restaurant_location;
      const deliveryLocation = currentJob.data.delivery_address;
      
      console.log('📦 Order data:', {
        restaurant_location: restaurantLocation,
        delivery_address: deliveryLocation,
        restaurant_name: currentJob.data.restaurant_name,
        customer_name: currentJob.data.customer_name
      });
      
      if (restaurantLocation) {
        const lat = parseCoordinate(restaurantLocation.latitude);
        const lng = parseCoordinate(restaurantLocation.longitude);
        
        console.log('🏪 Restaurant coords:', { lat, lng, raw: restaurantLocation });
        
        if (lat !== null && lng !== null) {
          pickupLocation = { lat, lng };
          
          // Restaurant marker (pickup) - Restaurant/Store icon
          new google.maps.Marker({
            position: pickupLocation,
            map,
            icon: {
              url: createIconUrl('🏪', '#FF6B6B'),
              scaledSize: new google.maps.Size(48, 48),
              anchor: new google.maps.Point(24, 24),
            },
            title: 'Pickup: ' + currentJob.data.restaurant_name,
            zIndex: 900,
          });
        } else {
          console.warn('Invalid restaurant coordinates:', restaurantLocation);
        }
      }

      if (deliveryLocation) {
        const lat = parseCoordinate(deliveryLocation.latitude);
        const lng = parseCoordinate(deliveryLocation.longitude);
        
        if (lat !== null && lng !== null) {
          dropoffLocation = { lat, lng };
          
          // Customer marker (dropoff) - Home/Person icon
          new google.maps.Marker({
            position: dropoffLocation,
            map,
            icon: {
              url: createIconUrl('🏠', '#4CAF50'),
              scaledSize: new google.maps.Size(48, 48),
              anchor: new google.maps.Point(24, 24),
            },
            title: 'Dropoff: ' + currentJob.data.customer_name,
            zIndex: 800,
          });
        } else {
          console.warn('Invalid delivery coordinates:', deliveryLocation);
        }
      }
    } else {
      // Moto-taxi: Customer pickup, Destination dropoff
      const pickup = currentJob.data.pickup_location;
      const dropoff = currentJob.data.dropoff_location;
      
      if (pickup) {
        const lat = parseCoordinate(pickup.latitude);
        const lng = parseCoordinate(pickup.longitude);
        
        if (lat !== null && lng !== null) {
          pickupLocation = { lat, lng };
          
          // Customer pickup marker - Person icon
          new google.maps.Marker({
            position: pickupLocation,
            map,
            icon: {
              url: createIconUrl('👤', '#4CAF50'),
              scaledSize: new google.maps.Size(48, 48),
              anchor: new google.maps.Point(24, 24),
            },
            title: 'Pickup: ' + currentJob.data.customer_name,
            zIndex: 900,
          });
        }
      }

      if (dropoff) {
        const lat = parseCoordinate(dropoff.latitude);
        const lng = parseCoordinate(dropoff.longitude);
        
        if (lat !== null && lng !== null) {
          dropoffLocation = { lat, lng };
          
          // Destination marker - Flag/Pin icon
          new google.maps.Marker({
            position: dropoffLocation,
            map,
            icon: {
              url: createIconUrl('📍', '#FF6B6B'),
              scaledSize: new google.maps.Size(48, 48),
              anchor: new google.maps.Point(24, 24),
            },
            title: 'Dropoff: ' + dropoff.address,
            zIndex: 800,
          });
        }
      }
    }

    // Draw route using Routes API (new)
    if (pickupLocation || dropoffLocation) {
      const origin = userPosition; // Use userPosition with proper lat/lng
      const destination = currentJob.data.status === 'picked_up' || currentJob.data.status === 'out_for_delivery'
        ? dropoffLocation
        : pickupLocation;

      if (destination) {
        console.log('🗺️ Getting route from', origin, 'to', destination);
        fetchRouteFromRoutesAPI(origin, destination, map);
      }
    }

    // Fit bounds to show all markers
    try {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(userPosition); // Use userPosition instead of userLocation
      if (pickupLocation) bounds.extend(pickupLocation);
      if (dropoffLocation) bounds.extend(dropoffLocation);
      map.fitBounds(bounds);
      console.log('✅ Map bounds fitted successfully');
    } catch (error) {
      console.error('❌ Error fitting map bounds:', error);
    }
  } catch (error) {
    console.error('❌ Error initializing map:', error);
    setMapError('Failed to initialize map: ' + error.message);
    setMapLoaded(false);
  }
};

// Fetch route using Google Routes API (new)
const fetchRouteFromRoutesAPI = async (origin: any, destination: any, map: any) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDJqsXxZXuu808lFZXARvy4rd0xktuqwJQ';
    
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng,
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng,
          }
        }
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      languageCode: 'en-US',
      units: 'METRIC',
    };

    console.log('📡 Calling Routes API...');
    
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Routes API error:', response.status, errorText);
      throw new Error(`Routes API failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Routes API response:', data);

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      
      // Extract distance and duration
      const distanceMeters = route.distanceMeters;
      const durationSeconds = parseInt(route.duration.replace('s', ''));
      
      const distanceKm = (distanceMeters / 1000).toFixed(1);
      const durationMins = Math.ceil(durationSeconds / 60);
      
      setDistanceToDestination(`${distanceKm} km`);
      setEtaToDestination(`${durationMins} mins`);
      
      console.log(`✅ Route loaded: ${distanceKm} km, ${durationMins} mins`);

      // Draw polyline on map
      const google = (window as any).google;
      if (google && route.polyline?.encodedPolyline) {
        const path = google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
        
        const polyline = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: '#2196F3',
          strokeOpacity: 1.0,
          strokeWeight: 4,
          map: map,
        });

        console.log('✅ Route polyline drawn on map');
      }
    } else {
      console.warn('⚠️ No routes found in response');
    }
  } catch (error) {
    console.error('❌ Error fetching route:', error);
    setDistanceToDestination('N/A');
    setEtaToDestination('N/A');
  }
};

  const handleStatusUpdate = async (newStatus: string) => {
    if (!currentJob) return;

    try {
      if (currentJob.type === 'order') {
        await api.put(`/orders/${currentJob.data.id}/status`, { status: newStatus });
      } else {
        await api.put(`/rider/rides/${currentJob.data.id}/status`, { status: newStatus });
      }
      
      Alert.alert('Success', 'Status updated successfully');
      fetchCurrentJob();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    }
  };

  const getNextAction = () => {
    if (!currentJob) return null;

    const status = currentJob.data.status;
    
    if (currentJob.type === 'order') {
      if (status === 'rider_assigned') return { label: 'Arrived at Restaurant', status: 'picked_up', icon: 'checkmark-circle' };
      if (status === 'picked_up') return { label: 'Start Delivery', status: 'out_for_delivery', icon: 'bicycle' };
      if (status === 'out_for_delivery') return { label: 'Mark as Delivered', status: 'delivered', icon: 'checkmark-done' };
    } else {
      if (status === 'accepted') return { label: 'Arrived at Pickup', status: 'rider_arrived', icon: 'location' };
      if (status === 'rider_arrived') return { label: 'Picked Up Customer', status: 'picked_up', icon: 'person' };
      if (status === 'picked_up') return { label: 'Start Trip', status: 'in_transit', icon: 'bicycle' };
      if (status === 'in_transit') return { label: 'Complete Trip', status: 'completed', icon: 'checkmark-done' };
    }
    
    return null;
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

  if (!currentJob) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="bicycle-outline" size={80} color="#CCC" />
          <Text style={styles.emptyText}>No Active Job</Text>
          <Text style={styles.emptySubtext}>Accept an order or ride to start navigation</Text>
        </View>
      </SafeAreaView>
    );
  }

  const nextAction = getNextAction();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Full-screen Map */}
        {Platform.OS === 'web' ? (
          <View style={styles.fullScreenMap}>
            {!mapLoaded && !mapError && (
              <View style={styles.mapLoadingOverlay}>
                <ActivityIndicator size="large" color="#FF6B6B" />
                <Text style={styles.mapLoadingText}>Loading map...</Text>
              </View>
            )}
            {mapError && (
              <View style={styles.mapLoadingOverlay}>
                <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
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
            {/* @ts-ignore - Web-only div for Google Maps */}
            {Platform.OS === 'web' ? (
              <View style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: mapLoaded ? 1 : 0,
              }}>
                <div 
                  ref={mapRef} 
                  style={{ 
                    width: '100%', 
                    height: '100%',
                  }} 
                />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.fullScreenMap, styles.mapPlaceholder]}>
            <Ionicons name="map" size={64} color="#CCC" />
            <Text style={styles.mapPlaceholderText}>Map available on web</Text>
          </View>
        )}

        {/* Back Button Overlay */}
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={[styles.backButtonOverlay, { top: insets.top + 10 }]}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        {/* Draggable Bottom Sheet */}
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose={false}
          backgroundStyle={styles.bottomSheetBackground}
          handleIndicatorStyle={styles.bottomSheetIndicator}
        >
          <BottomSheetScrollView style={styles.bottomSheetContent}>
            {/* Minimized View - Key Info */}
            <View style={styles.minimizedSection}>
              <View style={styles.minimizedHeader}>
                <View style={styles.jobTypeBadge}>
                  <Text style={styles.jobTypeEmoji}>
                    {currentJob.type === 'order' ? '🍔' : '🏍️'}
                  </Text>
                  <Text style={styles.jobTypeText}>
                    {currentJob.type === 'order' ? 'Food Delivery' : 'Moto-Taxi'}
                  </Text>
                </View>
                <View style={styles.earningsBadge}>
                  <Text style={styles.earningsText}>
                    ₱{currentJob.type === 'order' 
                      ? currentJob.data.total_amount.toFixed(2)
                      : currentJob.data.actual_fare.toFixed(2)}
                  </Text>
                </View>
              </View>

              {distanceToDestination && etaToDestination && (
                <View style={styles.minimizedETA}>
                  <View style={styles.etaItem}>
                    <Ionicons name="navigate" size={16} color="#2196F3" />
                    <Text style={styles.etaText}>{distanceToDestination}</Text>
                  </View>
                  <Text style={styles.etaDot}>•</Text>
                  <View style={styles.etaItem}>
                    <Ionicons name="time-outline" size={16} color="#2196F3" />
                    <Text style={styles.etaText}>{etaToDestination}</Text>
                  </View>
                </View>
              )}

              <Text style={styles.pullUpHint}>↑ Pull up for details</Text>
            </View>

            {/* Full Details - Visible when dragged up */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>
                {currentJob.type === 'order' ? 'Delivery Details' : 'Ride Details'}
              </Text>

              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={20} color="#4CAF50" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Pickup Location</Text>
                    <Text style={styles.detailValue}>
                      {currentJob.type === 'order'
                        ? currentJob.data.restaurant_name
                        : currentJob.data.customer_name}
                    </Text>
                    <Text style={styles.detailSubValue}>
                      {currentJob.type === 'order'
                        ? currentJob.data.restaurant_location?.address || ''
                        : currentJob.data.pickup_location?.address || ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeDivider}>
                  <View style={styles.routeLine} />
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="location" size={20} color="#FF6B6B" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Drop-off Location</Text>
                    <Text style={styles.detailValue}>
                      {currentJob.type === 'order'
                        ? currentJob.data.customer_name || 'Customer'
                        : 'Destination'}
                    </Text>
                    <Text style={styles.detailSubValue}>
                      {currentJob.type === 'order'
                        ? currentJob.data.delivery_address?.address
                        : currentJob.data.dropoff_location?.address}
                    </Text>
                  </View>
                </View>
              </View>

              {currentJob.type === 'order' && currentJob.data.items && (
                <>
                  <Text style={styles.sectionTitle}>Order Items</Text>
                  <View style={styles.itemsCard}>
                    {currentJob.data.items.map((item: any, index: number) => (
                      <View key={index} style={styles.itemRow}>
                        <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                        <Text style={styles.itemName}>{item.name}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {nextAction && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleStatusUpdate(nextAction.status)}
                >
                  <Ionicons name={nextAction.icon as any} size={24} color="#FFF" />
                  <Text style={styles.actionButtonText}>{nextAction.label}</Text>
                </TouchableOpacity>
              )}
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
  minimizedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  jobTypeEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  jobTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  earningsBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  earningsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  minimizedETA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  etaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  etaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  etaDot: {
    fontSize: 14,
    color: '#DDD',
    marginHorizontal: 12,
  },
  pullUpHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 12,
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
  detailCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  detailSubValue: {
    fontSize: 14,
    color: '#666',
  },
  routeDivider: {
    paddingVertical: 12,
    paddingLeft: 8,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#DDD',
    marginLeft: 9,
  },
  itemsCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
    marginRight: 8,
    minWidth: 30,
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  actionButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  mapPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
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
    color: '#FF6B6B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
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
  infoCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  jobType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  jobTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  amountBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  amountText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  locationInfo: {
    gap: 12,
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  etaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  etaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  etaDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#90CAF9',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    padding: 18,
    borderRadius: 16,
    gap: 12,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});
