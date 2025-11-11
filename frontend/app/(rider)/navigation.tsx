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
import { useAuthStore } from '../../store/authStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function RiderNavigationScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();
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
  
  // Turn-by-turn navigation states
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState<any>(null);
  const [navigationSteps, setNavigationSteps] = useState<any[]>([]);
  const [remainingDistance, setRemainingDistance] = useState<string>('');
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [currentBearing, setCurrentBearing] = useState<number>(0);
  const directionsRendererRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const directionConeRef = useRef<any>(null);

  useEffect(() => {
    // Wait for auth to load and verify user is a rider before fetching
    if (authLoading || !user || user.role !== 'rider') {
      console.log('⚠️ Waiting for authentication or user is not a rider');
      return;
    }

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
  }, [user, authLoading]); // Depend on user and authLoading

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
    // Guard: Only fetch if user is a rider
    if (!user || user.role !== 'rider') {
      console.log('⚠️ Skipping job fetch - user is not a rider');
      setCurrentJob(null);
      setLoading(false);
      return;
    }

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
    } catch (error: any) {
      console.error('Error fetching current job:', error);
      
      // Handle 403 (Forbidden) - user is not a rider
      if (error.response?.status === 403) {
        console.log('User does not have rider access');
        setCurrentJob(null);
        setLoading(false);
        return;
      }
      
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
      
      // Check if order/ride is completed
      if (newStatus === 'delivered' || newStatus === 'completed') {
        // Clear navigation state immediately
        setIsNavigating(false);
        setCurrentJob(null);
        
        // Show success message and redirect
        if (Platform.OS === 'web') {
          // For web, use window.confirm or just redirect immediately
          const confirmed = window.confirm('Order completed successfully! Great job! Redirecting to home...');
          router.replace('/(rider)');
        } else {
          // For mobile, use Alert with callback
          Alert.alert(
            'Success', 
            'Order completed successfully! Great job!',
            [
              {
                text: 'OK',
                onPress: () => {
                  router.replace('/(rider)');
                }
              }
            ]
          );
        }
      } else {
        Alert.alert('Success', 'Status updated successfully');
        fetchCurrentJob();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    }
  };

  // Start turn-by-turn navigation
  const startNavigation = async () => {
    if (!userLocation || !currentJob || !mapInstanceRef.current) {
      Alert.alert('Error', 'Cannot start navigation. Location or job data missing.');
      return;
    }

    try {
      console.log('🧭 Starting turn-by-turn navigation...');
      setIsNavigating(true);

      // Get destination based on job status
      let destination;
      if (currentJob.type === 'order') {
        const status = currentJob.data.status;
        if (status === 'accepted' || status === 'rider_assigned') {
          // Go to restaurant
          destination = {
            lat: currentJob.data.restaurant_location?.latitude,
            lng: currentJob.data.restaurant_location?.longitude,
          };
        } else {
          // Go to customer
          destination = {
            lat: currentJob.data.delivery_address?.latitude,
            lng: currentJob.data.delivery_address?.longitude,
          };
        }
      } else {
        // Moto-taxi
        const status = currentJob.data.status;
        if (status === 'accepted') {
          destination = {
            lat: currentJob.data.pickup_location?.latitude,
            lng: currentJob.data.pickup_location?.longitude,
          };
        } else {
          destination = {
            lat: currentJob.data.dropoff_location?.latitude,
            lng: currentJob.data.dropoff_location?.longitude,
          };
        }
      }

      if (!destination.lat || !destination.lng) {
        Alert.alert('Error', 'Invalid destination coordinates');
        return;
      }

      // Use Google Maps Directions API
      const google = (window as any).google;
      if (!google || !google.maps) {
        Alert.alert('Error', 'Google Maps not loaded');
        return;
      }

      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map: mapInstanceRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#4285F4', // Google Maps blue
          strokeWeight: 8, // Thicker line like Google Maps
          strokeOpacity: 1,
        },
      });

      directionsRendererRef.current = directionsRenderer;

      const request = {
        origin: { lat: userLocation.latitude, lng: userLocation.longitude },
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
      };

      directionsService.route(request, (result: any, status: any) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result);
          
          const route = result.routes[0];
          const leg = route.legs[0];
          
          setNavigationSteps(leg.steps);
          setCurrentStep(leg.steps[0]);
          setRemainingDistance(leg.distance.text);
          setRemainingTime(leg.duration.text);

          console.log('✅ Navigation started with', leg.steps.length, 'steps');
          console.log('🎬 Starting native smooth transition...');

          // ========================================
          // NATIVE GOOGLE MAPS SMOOTH TRANSITION
          // Using Google Maps' built-in smooth animations
          // ========================================
          
          const currentLocation = { lat: userLocation.latitude, lng: userLocation.longitude };
          
          // Calculate initial bearing for heading
          let initialBearing = 0;
          if (leg.steps[0]) {
            const firstStepStart = leg.steps[0].start_location;
            const firstStepEnd = leg.steps[0].end_location;
            initialBearing = google.maps.geometry.spherical.computeHeading(
              firstStepStart,
              firstStepEnd
            );
          }

          // STEP 1: Minimize bottom sheet FIRST (sequential, not simultaneous)
          console.log('📱 Step 1: Minimizing bottom sheet...');
          if (bottomSheetRef.current) {
            bottomSheetRef.current.snapToIndex(0);
          }

          // STEP 2: Wait for bottom sheet to finish minimizing, THEN animate map
          setTimeout(() => {
            console.log('🗺️ Step 2: Starting map transition...');
            
            // Keep map styling minimal for best performance - no extra styling

            // Ultra-smooth zoom animation - 1 second like Google Maps
            const startZoom = mapInstanceRef.current.getZoom() || 14;
            const targetZoom = 18;
            const zoomDuration = 1000; // 1 second - fast like Google Maps
            const zoomStartTime = Date.now();
            
            // Easing function for smooth acceleration/deceleration
            const easeInOutQuad = (t: number): number => {
              return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            };

            // Smooth continuous zoom animation (map stays interactive)
            const animateZoom = () => {
              if (!mapInstanceRef.current) return;

              const elapsed = Date.now() - zoomStartTime;
              const progress = Math.min(elapsed / zoomDuration, 1);
              const easedProgress = easeInOutQuad(progress);
              
              // Calculate current zoom level with easing
              const currentZoom = startZoom + ((targetZoom - startZoom) * easedProgress);
              
              // Keep centering on rider location during zoom
              mapInstanceRef.current.panTo(currentLocation);
              mapInstanceRef.current.setZoom(currentZoom);

              if (progress < 1) {
                // Continue animation - map remains interactive for user
                requestAnimationFrame(animateZoom);
              } else {
                // Animation complete - set final values
                mapInstanceRef.current.setZoom(targetZoom);
                mapInstanceRef.current.panTo(currentLocation);
                
                // Apply tilt and heading simultaneously at the end
                if (mapInstanceRef.current.setTilt) {
                  mapInstanceRef.current.setTilt(45);
                }
                
                if (mapInstanceRef.current.setHeading) {
                  mapInstanceRef.current.setHeading(initialBearing);
                }
                
                console.log('✅ Map transition complete - GPS navigation mode activated');
              }
            };

            // Start the smooth zoom animation
            requestAnimationFrame(animateZoom);
          }, 400); // Wait 400ms for bottom sheet to finish minimizing
          console.log('📍 Map will follow your movement automatically');
          
          // Speak first instruction if possible
          if (leg.steps[0]?.instructions) {
            speakInstruction(leg.steps[0].instructions);
          }
      } else {
          console.error('❌ Directions request failed:', status);
          Alert.alert('Error', 'Could not get directions');
          setIsNavigating(false);
        }
      });

    } catch (error) {
      console.error('❌ Error starting navigation:', error);
      Alert.alert('Error', 'Failed to start navigation');
      setIsNavigating(false);
    }
  };

  // Stop navigation
  const stopNavigation = () => {
    console.log('🛑 Stopping navigation');
    setIsNavigating(false);
    setCurrentStep(null);
    setNavigationSteps([]);
    setRemainingDistance('');
    setRemainingTime('');
    setCurrentBearing(0);
    previousLocationRef.current = null;
    
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    // Remove rider marker and direction cone
    if (riderMarkerRef.current) {
      riderMarkerRef.current.setMap(null);
      riderMarkerRef.current = null;
    }
    
    if (directionConeRef.current) {
      directionConeRef.current.setMap(null);
      directionConeRef.current = null;
    }

    // Reset map to normal view
    if (mapInstanceRef.current) {
      // Reset zoom
      mapInstanceRef.current.setZoom(14);
      
      // Reset heading (rotation) to north
      if (mapInstanceRef.current.setHeading) {
        mapInstanceRef.current.setHeading(0);
      }
      
      // Reset tilt to flat view
      if (mapInstanceRef.current.setTilt) {
        mapInstanceRef.current.setTilt(0);
      }
      
      // Re-center on current location if available
      if (userLocation) {
        mapInstanceRef.current.panTo({
          lat: userLocation.latitude,
          lng: userLocation.longitude
        });
      }
    }
    
    // Reload the normal route to show overview
    loadMap();
  };

  // Text-to-speech for navigation instructions
  const speakInstruction = (instruction: string) => {
    if ('speechSynthesis' in window) {
      // Remove HTML tags
      const cleanText = instruction.replace(/<[^>]*>/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Previous location for calculating bearing
  const previousLocationRef = useRef<any>(null);

  // Update navigation based on current location - Auto-follow like Google Maps
  useEffect(() => {
    if (isNavigating && userLocation && navigationSteps.length > 0 && mapInstanceRef.current) {
      const google = (window as any).google;
      if (!google || !google.maps) return;

      const currentLatLng = new google.maps.LatLng(userLocation.latitude, userLocation.longitude);
      
      // Calculate bearing (direction of travel) for map rotation
      let bearing = 0;
      if (previousLocationRef.current) {
        const prevLatLng = new google.maps.LatLng(
          previousLocationRef.current.latitude,
          previousLocationRef.current.longitude
        );
        bearing = google.maps.geometry.spherical.computeHeading(prevLatLng, currentLatLng);
        setCurrentBearing(bearing);
      }
      previousLocationRef.current = userLocation;

      // Create or update rider marker with direction cone (flashlight effect)
      if (!riderMarkerRef.current) {
        // Create arrow marker pointing in direction of travel
        riderMarkerRef.current = new google.maps.Marker({
          position: currentLatLng,
          map: mapInstanceRef.current,
          icon: {
            path: 'M 0,-2 L -1.5,2 L 0,1 L 1.5,2 Z', // Arrow shape
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 6,
            rotation: bearing, // Rotate arrow based on direction
            anchor: new google.maps.Point(0, 0),
          },
          zIndex: 2000,
        });

        // Create direction cone (flashlight)
        const coneSize = 0.0008; // Adjust size as needed
        const coneAngle = 60; // Cone width in degrees
        
        const conePath = [];
        conePath.push(currentLatLng); // Start at rider position
        
        // Create arc for the cone
        for (let i = -coneAngle / 2; i <= coneAngle / 2; i += 5) {
          const angle = bearing + i;
          const point = google.maps.geometry.spherical.computeOffset(
            currentLatLng,
            coneSize * 111000, // Convert to meters
            angle
          );
          conePath.push(point);
        }
        conePath.push(currentLatLng); // Close the path

        directionConeRef.current = new google.maps.Polygon({
          paths: conePath,
          map: mapInstanceRef.current,
          fillColor: '#4285F4',
          fillOpacity: 0.3,
          strokeColor: '#4285F4',
          strokeOpacity: 0.5,
          strokeWeight: 1,
          zIndex: 1999,
        });
      } else {
        // Update marker position and rotation
        riderMarkerRef.current.setPosition(currentLatLng);
        
        // Update arrow rotation to point in direction of travel
        const icon = riderMarkerRef.current.getIcon();
        if (icon && typeof icon === 'object') {
          riderMarkerRef.current.setIcon({
            ...icon,
            rotation: bearing,
          });
        }
        
        // Update direction cone
        if (directionConeRef.current) {
          const coneSize = 0.0008;
          const coneAngle = 60;
          
          const conePath = [];
          conePath.push(currentLatLng);
          
          for (let i = -coneAngle / 2; i <= coneAngle / 2; i += 5) {
            const angle = bearing + i;
            const point = google.maps.geometry.spherical.computeOffset(
              currentLatLng,
              coneSize * 111000,
              angle
            );
            conePath.push(point);
          }
          conePath.push(currentLatLng);
          
          directionConeRef.current.setPaths(conePath);
        }
      }

      // Smoothly animate map to follow rider's location with rotation
      mapInstanceRef.current.panTo(currentLatLng);
      
      // Set map heading (rotation) based on direction of travel
      if (mapInstanceRef.current.setHeading) {
        mapInstanceRef.current.setHeading(bearing);
      }
      
      // Tilt map for 3D navigation view
      if (mapInstanceRef.current.setTilt) {
        mapInstanceRef.current.setTilt(45); // 45-degree tilt for navigation mode
      }

      // Keep zoom level for navigation
      if (mapInstanceRef.current.getZoom() !== 18) {
        mapInstanceRef.current.setZoom(18);
      }

      // Find closest upcoming step
      let closestStepIndex = 0;
      let minDistance = Infinity;

      navigationSteps.forEach((step, index) => {
        const stepLatLng = new google.maps.LatLng(step.start_location.lat(), step.start_location.lng());
        const distance = google.maps.geometry.spherical.computeDistanceBetween(currentLatLng, stepLatLng);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestStepIndex = index;
        }
      });

      // Update current step if changed
      if (closestStepIndex !== navigationSteps.indexOf(currentStep)) {
        const newStep = navigationSteps[closestStepIndex];
        setCurrentStep(newStep);
        
        // Speak new instruction
        if (newStep?.instructions) {
          speakInstruction(newStep.instructions);
        }
      }

      // Update remaining distance/time
      let totalDistance = 0;
      let totalDuration = 0;
      
      for (let i = closestStepIndex; i < navigationSteps.length; i++) {
        totalDistance += navigationSteps[i].distance.value;
        totalDuration += navigationSteps[i].duration.value;
      }

      setRemainingDistance(`${(totalDistance / 1000).toFixed(1)} km`);
      setRemainingTime(`${Math.ceil(totalDuration / 60)} min`);
    }
  }, [userLocation, isNavigating]);

  // Initialize idle map (no active job) - MOVED TO TOP TO FIX HOOKS ERROR
  useEffect(() => {
    // Only initialize if no current job and conditions are met
    if (!currentJob && Platform.OS === 'web' && mapRef.current && userLocation) {
      const google = (window as any).google;
      if (google && google.maps && !mapInstanceRef.current) {
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: userLocation.latitude, lng: userLocation.longitude },
          zoom: 15,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        
        // Add rider marker
        new google.maps.Marker({
          position: { lat: userLocation.latitude, lng: userLocation.longitude },
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#FF6B6B',
            fillOpacity: 1,
            strokeColor: '#FFF',
            strokeWeight: 3,
          },
          title: 'Your Location'
        });
        
        mapInstanceRef.current = map;
      }
    }
  }, [currentJob, userLocation]);

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

  // Early return if user is not a rider
  if (user && user.role !== 'rider') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed" size={80} color="#FF6B6B" />
          <Text style={styles.emptyText}>Access Restricted</Text>
          <Text style={styles.emptySubtext}>This screen is only accessible to riders</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.backButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B6B" />
        </View>
      </SafeAreaView>
    );
  }

  // Show rider's current location on map even without active job
  if (!currentJob) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* Full-screen Map showing rider's current location */}
          {Platform.OS === 'web' ? (
            <View style={styles.fullScreenMap}>
              <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            </View>
          ) : null}

          {/* Info overlay */}
          <View style={styles.noJobOverlay}>
            <View style={styles.noJobCard}>
              <Ionicons name="bicycle-outline" size={60} color="#FF6B6B" />
              <Text style={styles.noJobTitle}>Ready for Delivery</Text>
              <Text style={styles.noJobSubtext}>Your current location is shown on the map</Text>
              <Text style={styles.noJobSubtext}>Accept an order to start navigation</Text>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
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
            {/* Minimized View - Shows navigation or job info */}
            <View style={styles.minimizedSection}>
              {isNavigating && currentStep ? (
                // Navigation Mode - Show turn-by-turn instruction
                <View style={styles.navigationMode}>
                  <View style={styles.navigationHeader}>
                    <View style={styles.navigationInfo}>
                      <Text style={styles.navigationDistance}>{remainingDistance}</Text>
                      <Text style={styles.navigationTime}>{remainingTime}</Text>
                    </View>
                    <TouchableOpacity onPress={stopNavigation} style={styles.stopNavButton}>
                      <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.instructionRow}>
                    <View style={styles.maneuverIcon}>
                      <Ionicons name="arrow-up" size={32} color="#4CAF50" />
                    </View>
                    <Text style={styles.instructionText} numberOfLines={2}>
                      {currentStep.instructions?.replace(/<[^>]*>/g, '') || 'Continue on current road'}
                    </Text>
                  </View>
                </View>
              ) : (
                // Normal Mode - Compact job info
                <View style={styles.minimizedRow}>
                  <View style={styles.compactInfo}>
                    <Text style={styles.compactEmoji}>
                      {currentJob.type === 'order' ? '🍔' : '🏍️'}
                    </Text>
                    <Text style={styles.compactText}>
                      ₱{currentJob.type === 'order' 
                        ? currentJob.data.total_amount.toFixed(2)
                        : currentJob.data.actual_fare.toFixed(2)}
                    </Text>
                    {distanceToDestination && (
                      <>
                        <Text style={styles.compactDivider}>•</Text>
                        <Text style={styles.compactSubText}>{distanceToDestination}</Text>
                        <Text style={styles.compactDivider}>•</Text>
                        <Text style={styles.compactSubText}>{etaToDestination}</Text>
                      </>
                    )}
                  </View>
                  <Ionicons name="chevron-up" size={20} color="#999" />
                </View>
              )}
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

              {/* Start/Stop Navigation Button */}
              {!isNavigating ? (
                <TouchableOpacity
                  style={styles.navigationButton}
                  onPress={startNavigation}
                >
                  <Ionicons name="navigate" size={24} color="#FFF" />
                  <Text style={styles.actionButtonText}>Start Navigation</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.stopNavigationButton}
                  onPress={stopNavigation}
                >
                  <Ionicons name="stop-circle" size={24} color="#FFF" />
                  <Text style={styles.actionButtonText}>Stop Navigation</Text>
                </TouchableOpacity>
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
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  minimizedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  compactText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
    marginRight: 8,
  },
  compactDivider: {
    fontSize: 16,
    color: '#DDD',
    marginHorizontal: 6,
  },
  compactSubText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
  navigationMode: {
    paddingVertical: 12,
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  navigationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  navigationDistance: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
  },
  navigationTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  stopNavButton: {
    padding: 4,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
  },
  maneuverIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
  },
  navigationButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  stopNavigationButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
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
  noJobOverlay: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  noJobCard: {
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 400,
  },
  noJobTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noJobSubtext: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 22,
  },
});
