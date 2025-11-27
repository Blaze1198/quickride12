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
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import api from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import {
  ETADisplay,
  RecenterButton,
  LaneGuidance,
  ProgressBar,
} from '../../components/NavigationFeatures';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Inner component with all the hooks - only renders for riders
function RiderNavigationContent() {
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
  const [nearbyOrders, setNearbyOrders] = useState<any[]>([]);
  const [showCongrats, setShowCongrats] = useState(false);
  const [completedDeliveryFee, setCompletedDeliveryFee] = useState('0');
  const [pendingJobNotification, setPendingJobNotification] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Animation for smooth transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Debug: Log every time currentJob changes
  useEffect(() => {
    console.log('🔄 currentJob STATE CHANGED:', currentJob ? `EXISTS (id: ${currentJob.data?.id})` : 'NULL');
  }, [currentJob]);

  // Smooth transition animation when switching between idle and active navigation
  useEffect(() => {
    if (isNavigating) {
      // Fade out then fade in with new content
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Reinitialize map for active navigation screen after transition
      setTimeout(() => {
        if (currentJob) {
          console.log('🗺️ Reinitializing map for active navigation');
          mapInstanceRef.current = null; // Clear old instance
          loadMap(); // Reinitialize with new mapRef
        }
      }, 350); // Wait for fade out to complete
    } else {
      // Simple fade in when returning to idle
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [isNavigating]);

  // Fetch nearby orders function (accessible globally)
  const fetchNearbyOrders = async () => {
    if (!currentJob && user?.role === 'rider') {
      try {
        const response = await api.get('/riders/nearby-orders?radius=10');
        const newOrders = response.data.orders || [];
        
        // Check if there are new orders compared to previous state
        if (nearbyOrders.length > 0 && newOrders.length > nearbyOrders.length) {
          console.log('🆕 New order available!');
          // Optionally expand bottom sheet to show new order
          if (bottomSheetRef.current) {
            bottomSheetRef.current.snapToIndex(1); // Snap to middle position
          }
        }
        
        setNearbyOrders(newOrders);
      } catch (error: any) {
        if (error?.response?.status === 401 || error?.response?.status === 403) return;
        console.error('Error fetching nearby orders:', error);
      }
    }
  };

  // Fetch nearby orders when on idle screen
  useEffect(() => {
    fetchNearbyOrders();
    // Poll for new orders every 5 seconds for real-time updates
    const interval = setInterval(fetchNearbyOrders, 5000);
    return () => clearInterval(interval);
  }, [currentJob, user, nearbyOrders.length]);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [distanceToDestination, setDistanceToDestination] = useState<string>('');
  const [etaToDestination, setEtaToDestination] = useState<string>('');
  const [mapError, setMapError] = useState<string>('');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  
  // Turn-by-turn navigation states
  const [currentStep, setCurrentStep] = useState<any>(null);
  const [navigationSteps, setNavigationSteps] = useState<any[]>([]);
  const [remainingDistance, setRemainingDistance] = useState<string>('');
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [currentBearing, setCurrentBearing] = useState<number>(0);
  const directionsRenderersRef = useRef<any[]>([]); // Store multiple renderers for multiple routes
  const riderMarkerRef = useRef<any>(null);
  const directionConeRef = useRef<any>(null);
  const previousLocationRef = useRef<any>(null); // Store previous location for bearing calculation
  const currentRoutePathRef = useRef<any[]>([]); // Store the current planned route path for deviation detection
  const lastRerouteTimeRef = useRef<number>(0); // Track when we last recalculated to avoid too frequent updates
  
  // Modern Google Maps features
  const [alternativeRoutes, setAlternativeRoutes] = useState<any[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [routeProgress, setRouteProgress] = useState<number>(0);
  const [totalRouteDistance, setTotalRouteDistance] = useState<number>(0);
  const [traveledDistance, setTraveledDistance] = useState<number>(0);
  const autoRecenterRef = useRef<boolean>(true); // Track if map should auto-follow rider (using ref for immediate updates)
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [riderLocationAddress, setRiderLocationAddress] = useState('Fetching location...');
  const [showLocationSearchModal, setShowLocationSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Wait for auth to load and verify user is a rider before fetching
    if (authLoading || !user || user.role !== 'rider') {
      console.log('⚠️ Waiting for authentication or user is not a rider');
      return;
    }

    fetchCurrentJob();
    
    // Refresh job every 10 seconds
    const jobInterval = setInterval(() => {
      fetchCurrentJob();
    }, 10000);
    
    // Start continuous GPS tracking with watchPosition for MAXIMUM SPEED and ACCURACY
    let watchId: number | null = null;
    
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      console.log('🛰️ Starting HIGH-ACCURACY GPS tracking...');
      
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const accuracy = position.coords.accuracy;
          
          // GPS ACCURACY FILTER: Only accept readings with good accuracy
          // Mobile GPS: typically 5-20m outdoors, 20-50m indoors
          // Reject readings with accuracy worse than 50 meters
          if (accuracy > 50) {
            console.log(`⚠️ GPS accuracy too low (${accuracy.toFixed(0)}m) - waiting for better signal...`);
            return; // Skip this reading and wait for better accuracy
          }
          
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed, // Speed in m/s
            heading: position.coords.heading, // Direction in degrees
            accuracy: accuracy, // Accuracy in meters
            timestamp: position.timestamp, // GPS timestamp
          };
          
          // Log GPS quality indicator
          let qualityIcon = '🟢'; // Good
          if (accuracy > 20) qualityIcon = '🟡'; // Medium
          if (accuracy > 35) qualityIcon = '🟠'; // Fair
          
          console.log(`📍 GPS ${qualityIcon}:`, {
            lat: location.latitude.toFixed(6),
            lng: location.longitude.toFixed(6),
            speed: location.speed ? `${(location.speed * 3.6).toFixed(1)} km/h` : 'N/A',
            heading: location.heading ? `${location.heading.toFixed(0)}°` : 'N/A',
            accuracy: `${accuracy.toFixed(0)}m`
          });
          
          setUserLocation(location);
        },
        (error) => {
          console.error('❌ GPS Error:', error.message);
          if (error.code === 1) {
            console.error('⚠️ Location permission denied - please enable GPS permissions');
          } else if (error.code === 2) {
            console.error('⚠️ Position unavailable - check if GPS is enabled on your device');
          } else if (error.code === 3) {
            console.error('⚠️ GPS timeout - trying again...');
          }
        },
        {
          enableHighAccuracy: true, // Force GPS hardware (not WiFi/cell tower)
          maximumAge: 0, // NEVER use cached position - always get fresh GPS data
          timeout: 10000, // Allow 10 seconds for high-accuracy GPS lock
          // These settings optimize for accuracy over speed
        }
      );
    }
    
    return () => {
      clearInterval(jobInterval);
      if (watchId !== null) {
        console.log('🛑 Stopping GPS tracking');
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [user, authLoading]); // Depend on user and authLoading

  // Separate effect for sending location updates to backend
  useEffect(() => {
    if (!userLocation || !user || user.role !== 'rider') return;

    // Send location update immediately when location changes
    updateRiderLocation();
  }, [userLocation, user]);

  // Real-time map tracking - Update rider position, rotate camera, and center map (OPTIMIZED FOR SPEED)
  useEffect(() => {
    if (!userLocation || !mapInstanceRef.current || !isNavigating) return;

    const google = (window as any).google;
    if (!google || !google.maps) return;

    const currentPosition = {
      lat: userLocation.latitude,
      lng: userLocation.longitude,
    };

    // Calculate bearing/heading from previous position if available
    if (previousLocationRef.current) {
      const prevPos = new google.maps.LatLng(
        previousLocationRef.current.latitude,
        previousLocationRef.current.longitude
      );
      const currPos = new google.maps.LatLng(userLocation.latitude, userLocation.longitude);
      
      // Calculate heading
      const heading = google.maps.geometry.spherical.computeHeading(prevPos, currPos);
      
      // INSTANT centering - no delay for maximum speed tracking
      if (autoRecenterRef.current) {
        // Use setCenter for INSTANT positioning (no animation)
        mapInstanceRef.current.set('programmatic_center', true);
        mapInstanceRef.current.setCenter(currentPosition);
        mapInstanceRef.current.set('programmatic_center', false);
      } else {
        console.log('   ⏸️ Auto-recenter disabled - skipping center');
      }
      
      // Set camera heading (rotation) to face direction of travel
      if (mapInstanceRef.current.setHeading) {
        mapInstanceRef.current.setHeading(heading);
      }
      
      // Set camera tilt for 3D navigation view
      if (mapInstanceRef.current.setTilt) {
        mapInstanceRef.current.setTilt(45); // 45 degree tilt
      }
      
      // Maintain good zoom level for navigation (but only if auto-recenter is on)
      if (autoRecenterRef.current && mapInstanceRef.current.getZoom() < 17) {
        mapInstanceRef.current.setZoom(17);
      }

      if (autoRecenterRef.current) {
        console.log(`🧭 Camera updated - Heading: ${heading.toFixed(0)}°, Position: ${currentPosition.lat.toFixed(6)}, ${currentPosition.lng.toFixed(6)}`);
      }
    }

    // Store current location as previous for next update
    previousLocationRef.current = userLocation;

  }, [userLocation?.latitude, userLocation?.longitude, isNavigating]); // Update when location changes

  // Initialize map only once when job ID changes
  useEffect(() => {
    const jobId = currentJob?.data?.id;
    
    // Skip if no job or not web platform
    if (!currentJob || Platform.OS !== 'web') {
      return;
    }
    
    // Skip if map is already initialized for the same job
    if (mapInstanceRef.current && currentJobIdRef.current === jobId) {
      console.log('⏭️ Map already initialized for job:', jobId);
      return;
    }
    
    // Only initialize if job ID has changed or map hasn't been initialized
    console.log('🗺️ Job changed or first load, initializing map for job:', jobId);
    currentJobIdRef.current = jobId;
    loadMap();
  }, [currentJob?.data?.id]); // Only trigger when job ID changes, not entire currentJob object

  const getUserLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed, // Speed in m/s
            heading: position.coords.heading, // Direction in degrees
          };
          console.log('📍 GPS Update:', {
            lat: location.latitude.toFixed(6),
            lng: location.longitude.toFixed(6),
            speed: location.speed ? `${(location.speed * 3.6).toFixed(1)} km/h` : 'N/A',
            heading: location.heading ? `${location.heading.toFixed(0)}°` : 'N/A'
          });
          setUserLocation(location);
        },
        (error) => {
          console.error('❌ Error getting location:', error.message);
          // Fallback to real location in Manila (Makati CBD)
          const fallbackLocation = {
            latitude: 14.5547,
            longitude: 121.0244,
          };
          console.log('⚠️ Using fallback location (Makati, Manila)');
          setUserLocation(fallbackLocation);
        },
        {
          enableHighAccuracy: true, // Use GPS, not network location
          timeout: 10000,
          maximumAge: 0 // Always get fresh location, no caching
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
    if (!userLocation) {
      console.log('⚠️ Cannot update location - userLocation is null');
      return;
    }
    
    console.log('📍 Sending location update to backend:', {
      lat: userLocation.latitude,
      lng: userLocation.longitude,
    });
    
    try {
      await api.put('/riders/location', {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        address: 'Current location',
      });
      console.log('✅ Location updated successfully:', userLocation);
    } catch (error) {
      console.error('❌ Error updating location:', error);
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
      console.log('📡 Fetching current job for rider...');
      
      // Try to get current order (food delivery)
      const orderResponse = await api.get('/rider/current-order');
      console.log('📦 Order response:', orderResponse.data);
      
      if (orderResponse.data) {
        console.log('✅ Setting current job as ORDER:', orderResponse.data.id);
        const jobData = { type: 'order', data: orderResponse.data };
        
        // Show notification when:
        // 1. New job assignment (different ID)
        // 2. Order becomes ready for pickup (status change to 'accepted' or 'rider_assigned')
        const isNewJob = !currentJob || currentJob.data.id !== orderResponse.data.id;
        const isReadyForPickup = currentJob && 
                                 currentJob.data.id === orderResponse.data.id &&
                                 (orderResponse.data.status === 'accepted' || orderResponse.data.status === 'rider_assigned') &&
                                 currentJob.data.status !== 'accepted' && 
                                 currentJob.data.status !== 'rider_assigned';
        
        if (isNewJob || isReadyForPickup) {
          console.log('🔔 Showing job notification:', isNewJob ? 'New job' : 'Ready for pickup');
          setPendingJobNotification(jobData);
        }
        
        setCurrentJob(jobData);
        setLoading(false);
        return;
      }

      // Try to get current ride
      const rideResponse = await api.get('/rider/current-ride');
      console.log('🚗 Ride response:', rideResponse.data);
      
      if (rideResponse.data) {
        console.log('✅ Setting current job as RIDE:', rideResponse.data.id);
        setCurrentJob({ type: 'ride', data: rideResponse.data });
        setLoading(false);
        return;
      }

      console.log('⚠️ No active job found - setting currentJob to null');
      setCurrentJob(null);
      setLoading(false);
    } catch (error: any) {
      console.log('❌ Error fetching current job:', error.response?.status, error.message);
      
      // Silently ignore auth errors (401/403) - user is not a rider
      if (error.response?.status === 403 || error.response?.status === 401) {
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
    
    // Disable auto-recenter when user manually interacts with the map
    let userInteractionTimer: any = null;
    
    const disableAutoRecenter = () => {
      console.log('❌ AUTO-RECENTER DISABLED BY USER INTERACTION');
      console.log('   Setting autoRecenterRef.current = false');
      autoRecenterRef.current = false;
      
      // Clear any pending re-enable
      if (userInteractionTimer) {
        clearTimeout(userInteractionTimer);
      }
    };
    
    google.maps.event.addListener(map, 'dragstart', () => {
      console.log('🖱️ User dragged map');
      disableAutoRecenter();
    });
    
    google.maps.event.addListener(map, 'zoom_changed', () => {
      console.log('🔍 User zoomed map');
      disableAutoRecenter();
    });
    console.log('✅ Map initialized successfully');

    // Create arrow icon for rider (navigation arrow)
    const createRiderArrowIcon = () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="100" viewBox="0 0 80 100">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
            </filter>
            <linearGradient id="spotlightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#4285F4;stop-opacity:0.6" />
              <stop offset="100%" style="stop-color:#4285F4;stop-opacity:0.05" />
            </linearGradient>
          </defs>
          <!-- Spotlight cone (direction indicator) -->
          <path d="M 40 50 L 20 10 L 60 10 Z" fill="url(#spotlightGradient)" opacity="0.5"/>
          <!-- Main blue circle -->
          <circle cx="40" cy="50" r="18" fill="#4285F4" filter="url(#shadow)"/>
          <!-- White arrow pointing up -->
          <path d="M 40 38 L 47 55 L 40 52 L 33 55 Z" fill="white"/>
        </svg>
      `;
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    };

    // Create location pin icon with emoji inside
    const createLocationPinIcon = (emoji: string, color: string) => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="60" viewBox="0 0 50 60">
          <defs>
            <filter id="shadow-${color}" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.4"/>
            </filter>
          </defs>
          <!-- Location pin shape -->
          <path d="M 25 5 C 15 5 7 13 7 23 C 7 33 25 50 25 50 C 25 50 43 33 43 23 C 43 13 35 5 25 5 Z" 
                fill="${color}" 
                stroke="white" 
                stroke-width="2" 
                filter="url(#shadow-${color})"/>
          <!-- Inner circle for emoji -->
          <circle cx="25" cy="23" r="12" fill="white"/>
          <text x="25" y="30" font-size="16" text-anchor="middle" fill="black">${emoji}</text>
        </svg>
      `;
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    };

    // Create rider marker using Google Maps arrow symbol for proper rotation
    const riderMarker = new google.maps.Marker({
      position: userPosition,
      map,
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: '#4285F4',
        fillOpacity: 1.0,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
        rotation: 0, // Will be updated with GPS heading
      },
      title: 'Your Location (Rider)',
      zIndex: 1000,
      optimized: false,
    });
    
    // Store rider marker in ref so it can be updated later
    riderMarkerRef.current = riderMarker;
    console.log('✅ [LOADMAP] Rider marker created with Google Maps arrow symbol');

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
          
          // Restaurant marker (pickup) - Location pin with restaurant icon
          const restaurantMarker = new google.maps.Marker({
            position: pickupLocation,
            map,
            icon: {
              url: createLocationPinIcon('🏪', '#EA4335'),
              scaledSize: new google.maps.Size(50, 60),
              anchor: new google.maps.Point(25, 55),
            },
            title: 'Pickup: ' + currentJob.data.restaurant_name,
            zIndex: 900,
            animation: google.maps.Animation.BOUNCE,
          });
          
          // Stop bouncing after 2 seconds
          setTimeout(() => {
            restaurantMarker.setAnimation(null);
          }, 2000);
        } else {
          console.warn('Invalid restaurant coordinates:', restaurantLocation);
        }
      }

      if (deliveryLocation) {
        const lat = parseCoordinate(deliveryLocation.latitude);
        const lng = parseCoordinate(deliveryLocation.longitude);
        
        if (lat !== null && lng !== null) {
          dropoffLocation = { lat, lng };
          
          // Customer marker (dropoff) - Location pin with home icon
          const customerMarker = new google.maps.Marker({
            position: dropoffLocation,
            map,
            icon: {
              url: createLocationPinIcon('🏠', '#34A853'),
              scaledSize: new google.maps.Size(50, 60),
              anchor: new google.maps.Point(25, 55),
            },
            title: 'Dropoff: ' + currentJob.data.customer_name,
            zIndex: 800,
            animation: google.maps.Animation.BOUNCE,
          });
          
          // Stop bouncing after 2 seconds
          setTimeout(() => {
            customerMarker.setAnimation(null);
          }, 2000);
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
          
          // Customer pickup marker - Location pin with person icon
          const pickupMarker = new google.maps.Marker({
            position: pickupLocation,
            map,
            icon: {
              url: createLocationPinIcon('👤', '#FBBC04'),
              scaledSize: new google.maps.Size(50, 60),
              anchor: new google.maps.Point(25, 55),
            },
            title: 'Pickup: ' + currentJob.data.customer_name,
            zIndex: 900,
            animation: google.maps.Animation.BOUNCE,
          });
          
          // Stop bouncing after 2 seconds
          setTimeout(() => {
            pickupMarker.setAnimation(null);
          }, 2000);
        }
      }

      if (dropoff) {
        const lat = parseCoordinate(dropoff.latitude);
        const lng = parseCoordinate(dropoff.longitude);
        
        if (lat !== null && lng !== null) {
          dropoffLocation = { lat, lng };
          
          // Destination marker - Location pin with flag icon
          const dropoffMarker = new google.maps.Marker({
            position: dropoffLocation,
            map,
            icon: {
              url: createLocationPinIcon('🚩', '#EA4335'),
              scaledSize: new google.maps.Size(50, 60),
              anchor: new google.maps.Point(25, 55),
            },
            title: 'Dropoff: ' + dropoff.address,
            zIndex: 800,
            animation: google.maps.Animation.BOUNCE,
          });
          
          // Stop bouncing after 2 seconds
          setTimeout(() => {
            dropoffMarker.setAnimation(null);
          }, 2000);
        }
      }
    }

    // Draw BOTH routes simultaneously - Rider to Restaurant AND Restaurant to Customer
    if (pickupLocation && dropoffLocation) {
      console.log('🗺️ Drawing two routes:');
      console.log('   Route 1: Rider → Restaurant');
      console.log('   Route 2: Restaurant → Customer');
      
      // Route 1: Rider to Restaurant (pickup location)
      fetchRouteFromDirectionsAPI(userPosition, pickupLocation, map, () => {
        console.log('✅ Route 1 displayed: Rider → Restaurant');
      }, '#4285F4'); // Blue color for first route
      
      // Route 2: Restaurant to Customer (dropoff location)
      // Use a different color to distinguish the two routes
      fetchRouteFromDirectionsAPI(pickupLocation, dropoffLocation, map, () => {
        console.log('✅ Route 2 displayed: Restaurant → Customer');
      }, '#34A853'); // Green color for second route
      
      // Fit bounds to show all three points
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(userPosition);
      bounds.extend(pickupLocation);
      bounds.extend(dropoffLocation);
      map.fitBounds(bounds);
    } else if (pickupLocation || dropoffLocation) {
      // Fallback: Only one location available
      const destination = dropoffLocation || pickupLocation;
      console.log('🗺️ Getting single route from rider to', destination);
      fetchRouteFromDirectionsAPI(userPosition, destination, map, () => {
        console.log('✅ Single route displayed');
      });
    } else {
      // Only fit bounds manually if we're NOT using DirectionsRenderer
      try {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(userPosition);
        if (pickupLocation) bounds.extend(pickupLocation);
        if (dropoffLocation) bounds.extend(dropoffLocation);
        map.fitBounds(bounds);
        console.log('✅ Map bounds fitted manually');
      } catch (error) {
        console.error('❌ Error fitting map bounds:', error);
      }
    }
  } catch (error) {
    console.error('❌ Error initializing map:', error);
    setMapError('Failed to initialize map: ' + error.message);
    setMapLoaded(false);
  }
};

// Fetch route using Google Directions API with native styling
const fetchRouteFromDirectionsAPI = async (origin: any, destination: any, map: any, onComplete?: () => void, routeColor: string = '#4285F4') => {
  try {
    console.log('📡 Starting Directions API call with native Google Maps styling...');
    console.log('📍 Origin:', JSON.stringify(origin));
    console.log('📍 Destination:', JSON.stringify(destination));
    console.log('🗺️ Map instance ref:', mapInstanceRef.current ? 'EXISTS' : 'NULL');
    
    const google = (window as any).google;
    if (!google || !google.maps) {
      console.error('❌ Google Maps not loaded');
      return;
    }

    console.log('✅ Google Maps API is available');

    // Use mapInstanceRef.current instead of the passed map parameter
    const mapInstance = mapInstanceRef.current;
    if (!mapInstance) {
      console.error('❌ Map instance not available');
      return;
    }

    // Don't clean up here - allows multiple routes to be drawn simultaneously
    // Cleanup happens when navigation ends or status changes

    const directionsService = new google.maps.DirectionsService();
    
    // Create renderer with Google Maps blue highlight for planned route
    const directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true, // We'll keep our custom markers
      polylineOptions: {
        strokeColor: '#4285F4', // Google Maps blue highlight
        strokeWeight: 8, // Thick highlighted line
        strokeOpacity: 1.0, // Full opacity
        zIndex: 1000, // High z-index
        geodesic: true, // Follow earth's curvature
      },
      preserveViewport: true, // Don't auto-zoom/pan when route is rendered
    });

    console.log('✅ DirectionsService and DirectionsRenderer created');
    
    // Set the map using mapInstanceRef.current
    directionsRenderer.setMap(mapInstance);
    console.log('✅ DirectionsRenderer map set to mapInstanceRef.current');

    // Store renderer for cleanup
    directionsRenderersRef.current.push(directionsRenderer);

    const request = {
      origin: origin,
      destination: destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true, // Enable alternative routes
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS,
      },
    };

    console.log('🗺️ Requesting directions with request:', JSON.stringify(request));

    directionsService.route(request, (result: any, status: any) => {
      console.log('📨 Directions API callback triggered. Status:', status);
      
      if (status === 'OK' && result) {
        console.log('✅ Directions API response received successfully!');
        console.log('📦 Routes count:', result.routes?.length);
        
        // Store alternative routes if available
        if (result.routes && result.routes.length > 1) {
          console.log(`🛣️  Found ${result.routes.length} alternative routes`);
          setAlternativeRoutes(result.routes);
        } else {
          setAlternativeRoutes([result.routes[0]]);
        }
        
        // Display the selected route on the map (default to first route)
        directionsRenderer.setDirections(result);
        console.log('✅ Directions set on renderer');
        
        // Verify the renderer has the map
        const rendererMap = directionsRenderer.getMap();
        console.log('🗺️ Renderer map:', rendererMap ? 'EXISTS' : 'NULL');
        
        // Get the selected route polyline
        const routeIndex = selectedRouteIndex < result.routes.length ? selectedRouteIndex : 0;
        const route = result.routes[routeIndex];
        const leg = route.legs[0];
        
        console.log('📍 Route overview polyline:', route.overview_polyline ? 'EXISTS' : 'MISSING');
        
        // Extract distance and duration
        const distanceKm = (leg.distance.value / 1000).toFixed(1);
        const durationMins = Math.ceil(leg.duration.value / 60);
        
        // Store total distance for progress calculation
        setTotalRouteDistance(leg.distance.value);
        
        setDistanceToDestination(`${distanceKm} km`);
        setEtaToDestination(`${durationMins} mins`);
        
        console.log(`✅ Route loaded: ${distanceKm} km, ${durationMins} mins, ${leg.steps.length} steps`);
        
        // Store navigation steps for potential turn-by-turn display
        const steps = leg.steps || [];
        setNavigationSteps(steps);
        
        // Store the route path for deviation detection
        const routePath = route.overview_path || [];
        currentRoutePathRef.current = routePath;
        console.log(`📌 Stored ${routePath.length} points for route deviation detection`);
        
        if (steps.length > 0) {
          setCurrentStep(steps[0]);
        }
        
        // Call completion callback
        if (onComplete) onComplete();
      } else {
        console.error('❌ Directions request failed with status:', status);
        console.error('❌ Result:', result);
        setDistanceToDestination('N/A');
        setEtaToDestination('N/A');
      }
    });
  } catch (error) {
    console.error('❌ Error fetching directions:', error);
    console.error('❌ Error stack:', error.stack);
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
    if (!mapInstanceRef.current) {
      Alert.alert('Error', 'Map not ready. Please wait a moment and try again.');
      return;
    }
    
    if (!currentJob || !userLocation) {
      Alert.alert('Error', 'Missing job information or location data.');
      return;
    }

    // Check if we already have navigation steps from the initial route fetch
    if (navigationSteps.length > 0) {
      console.log('🧭 Starting navigation with existing route data...');
      setIsNavigating(true);
      setCurrentStep(navigationSteps[0]);
      
      // The DirectionsRenderer is already showing the route
      // We just need to enable navigation mode
      console.log('✅ Navigation mode activated with', navigationSteps.length, 'steps');
      return;
    }

    // If no existing route data, fetch it now
    try {
      console.log('🧭 Fetching route for navigation...');
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

      // Only create new renderer if we don't have any
      if (directionsRenderersRef.current.length === 0) {
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map: mapInstanceRef.current,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#4285F4', // Google Maps blue
            strokeWeight: 6,
            strokeOpacity: 0.8,
          },
          preserveViewport: false,
        });
        directionsRenderersRef.current.push(directionsRenderer);
      }

      const directionsService = new google.maps.DirectionsService();
      const request = {
        origin: { lat: userLocation.latitude, lng: userLocation.longitude },
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
      };

      directionsService.route(request, (result: any, status: any) => {
        if (status === 'OK' && result) {
          directionsRenderersRef.current[0].setDirections(result);
          
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
    
    if (directionsRenderersRef.current.length > 0) {
      directionsRenderersRef.current.forEach(renderer => {
        renderer.setMap(null);
      });
      directionsRenderersRef.current = [];
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

  // Update rider marker position in real-time (works for both navigation and idle modes)
  useEffect(() => {
    if (!userLocation || !mapInstanceRef.current || !riderMarkerRef.current) {
      return;
    }
    
    const google = (window as any).google;
    if (!google || !google.maps) {
      return;
    }
    
    const newPosition = new google.maps.LatLng(userLocation.latitude, userLocation.longitude);
    
    // Calculate bearing if we have a previous location
    let bearing = currentBearing;
    if (previousLocationRef.current) {
      const prevLatLng = new google.maps.LatLng(
        previousLocationRef.current.latitude,
        previousLocationRef.current.longitude
      );
      
      // Calculate distance between positions to check if rider actually moved
      const distanceTraveled = google.maps.geometry.spherical.computeDistanceBetween(prevLatLng, newPosition);
      
      // Only calculate new bearing if rider moved more than 1 meter (reduces jitter when stationary)
      if (distanceTraveled > 1) {
        bearing = google.maps.geometry.spherical.computeHeading(prevLatLng, newPosition);
        setCurrentBearing(bearing);
        console.log(`🧭 Bearing updated: ${bearing.toFixed(1)}° (moved ${distanceTraveled.toFixed(1)}m)`);
      }
      
      setTraveledDistance((prev) => prev + distanceTraveled);
      
      // Update progress bar
      if (totalRouteDistance > 0) {
        const progress = (traveledDistance / totalRouteDistance) * 100;
        setRouteProgress(Math.min(100, progress));
      }
      
      // Update current step for turn-by-turn instructions
      if (navigationSteps.length > 0) {
        let accumulatedDistance = 0;
        for (const step of navigationSteps) {
          accumulatedDistance += step.distance.value;
          if (traveledDistance < accumulatedDistance) {
            setCurrentStep(step);
            break;
          }
        }
      }
    }
    previousLocationRef.current = userLocation;
    
    // REAL-TIME REROUTING: Check if rider has deviated from the planned route
    if (currentRoutePathRef.current.length > 0 && mapInstanceRef.current && currentJob) {
      const now = Date.now();
      const timeSinceLastReroute = now - lastRerouteTimeRef.current;
      
      // Check if rider is far from the route (more than 30 meters for sensitivity)
      let closestDistance = Infinity;
      for (const routePoint of currentRoutePathRef.current) {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(newPosition, routePoint);
        if (distance < closestDistance) {
          closestDistance = distance;
        }
      }
      
      // DEVIATION DETECTION: If more than 50m off route and at least 5 seconds since last reroute
      if (closestDistance > 50 && timeSinceLastReroute > 5000) {
        console.log(`🔄 REROUTING! Distance from route: ${closestDistance.toFixed(0)}m`);
        
        // Safety check: Ensure currentJob.data exists before accessing
        if (!currentJob || !currentJob.data) {
          console.log('⚠️ Cannot reroute - no current job data');
          return;
        }
        
        lastRerouteTimeRef.current = now;
        
        const { restaurant_location, customer_location, status } = currentJob.data;
        
        // Safety check: Ensure locations exist
        if (!restaurant_location || !customer_location) {
          console.log('⚠️ Cannot reroute - missing location data');
          return;
        }
        
        const destination = status === 'picked_up' 
          ? { lat: customer_location.latitude, lng: customer_location.longitude }
          : { lat: restaurant_location.latitude, lng: restaurant_location.longitude };
        
        console.log(`📍 Recalculating route to: ${status === 'picked_up' ? 'Customer' : 'Restaurant'}`);
        
        // Clear old route renderers before recalculating
        if (directionsRenderersRef.current && directionsRenderersRef.current.length > 0) {
          directionsRenderersRef.current.forEach(renderer => {
            if (renderer) {
              renderer.setMap(null); // Remove from map
            }
          });
          directionsRenderersRef.current = []; // Clear array
          console.log('🗑️ Cleared old route polylines');
        }
        
        // Recalculate route with fresh directions
        fetchRouteFromDirectionsAPI(
          { lat: userLocation.latitude, lng: userLocation.longitude },
          destination,
          mapInstanceRef.current
        );
      }
    }
    
    // INSTANT marker update (no animation for Google Maps-like responsiveness)
    const oldPosition = riderMarkerRef.current.getPosition();
    
    // Update position immediately
    riderMarkerRef.current.setPosition(newPosition);
    
    // Update marker rotation instantly - ALWAYS update for responsive arrow direction
    // Priority: Use GPS heading from device if available (most accurate), otherwise use calculated bearing
    const rotationAngle = userLocation.heading !== null && userLocation.heading !== undefined 
      ? userLocation.heading 
      : bearing;
    
    // ALWAYS update rotation when we have a valid angle (including 0° for north)
    if (riderMarkerRef.current && rotationAngle !== undefined && rotationAngle !== null) {
      const icon = riderMarkerRef.current.getIcon();
      if (icon && typeof icon === 'object') {
        riderMarkerRef.current.setIcon({
          ...icon,
          rotation: rotationAngle, // Use GPS heading if available, else calculated bearing
        });
        console.log(`🎯 Arrow rotation updated: ${rotationAngle.toFixed(1)}°`);
      }
    }
    
    // INSTANT map centering - no delay for maximum speed GPS tracking
    if (autoRecenterRef.current && mapInstanceRef.current) {
      // Mark this as programmatic pan so it doesn't trigger the center_changed listener
      mapInstanceRef.current.set('programmatic_center', true);
      
      // Use setCenter for INSTANT positioning (no animation delay like panTo)
      mapInstanceRef.current.setCenter(newPosition);
      
      // Reset flag immediately
      mapInstanceRef.current.set('programmatic_center', false);
    }
  }, [userLocation, currentBearing]);

  // Initialize idle map (no active job) - MOVED TO TOP TO FIX HOOKS ERROR
  useEffect(() => {
    // Don't initialize if there's an active job
    if (currentJob) {
      return; // Exit early if there's an active job, active nav will handle map
    }

    // AGGRESSIVE route clearing when returning to idle mode
    if (!currentJob && directionsRenderersRef.current && directionsRenderersRef.current.length > 0) {
      console.log('🗑️🗑️🗑️ AGGRESSIVE CLEARING: Removing all route renderers');
      directionsRenderersRef.current.forEach(renderer => {
        if (renderer) {
          renderer.setDirections(null); // Clear directions data
          renderer.setMap(null); // Remove from map
        }
      });
      directionsRenderersRef.current = []; // Clear array
    }
    
    // Also clear any polylines that might be lingering
    if (mapInstanceRef.current && !currentJob) {
      console.log('🧹 Clearing all overlays from map');
      // Get the map and clear it by setting a fresh instance or refreshing
      const map = mapInstanceRef.current;
      // This will remove all overlays
      if (map) {
        console.log('✅ Map cleaned for idle mode');
      }
    }

    // Only initialize if no current job and conditions are met
    if (!currentJob && Platform.OS === 'web' && userLocation) {
      const apiKey = 'AIzaSyA0m1oRlXLQWjxacqjEJ6zJW3WvmOWvQkQ';
      
      // Load Google Maps script first
      const loadGoogleMapsAndInitMap = async () => {
        // Check if script already exists
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        
        if (!existingScript) {
          console.log('📍 Loading Google Maps script for idle map...');
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
          script.async = true;
          script.defer = true;
          
          await new Promise((resolve, reject) => {
            script.onload = () => {
              console.log('✅ Google Maps script loaded');
              resolve(true);
            };
            script.onerror = () => {
              console.error('❌ Failed to load Google Maps script');
              reject(new Error('Failed to load Google Maps'));
            };
            document.head.appendChild(script);
          });
        }
        
        // Wait for mapRef to be available
        const initMap = () => {
          if (!mapRef.current) {
            console.log('⏳ Waiting for mapRef...');
            setTimeout(initMap, 100);
            return;
          }

          const google = (window as any).google;
          if (!google || !google.maps) {
            console.log('⏳ Waiting for Google Maps API...');
            setTimeout(initMap, 100);
            return;
          }

          if (mapInstanceRef.current) {
            console.log('✅ Idle map already initialized');
            return;
          }

          console.log('🗺️ Initializing idle map...');
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
              fillColor: '#210059',
              fillOpacity: 1,
              strokeColor: '#FFF',
              strokeWeight: 3,
            },
            title: 'Your Location'
          });
          
          mapInstanceRef.current = map;
          console.log('✅ Idle map initialized successfully');
        };

        initMap();
      };

      loadGoogleMapsAndInitMap().catch(err => {
        console.error('❌ Error loading Google Maps:', err);
      });
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

  // MUST compute nextAction before any conditional returns to avoid hooks violation
  const nextAction = getNextAction();

  // DEBUG: Log render state
  console.log('🎨 RENDER CHECK - loading:', loading, '| currentJob:', currentJob ? 'EXISTS (id: ' + currentJob.data?.id + ')' : 'NULL');

  // Render loading screen (auth and role already checked in wrapper)
  if (loading) {
    console.log('➡️ Rendering LOADING screen');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#210059" />
        </View>
      </SafeAreaView>
    );
  }

  // Render idle screen (clean map view OR job pending acceptance)
  const renderIdleScreen = () => {
    console.log('➡️ Rendering IDLE screen', currentJob ? '(job pending acceptance)' : '(no job)');
    
    console.log('🗺️ Initializing idle map...');
    
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          {/* Initialize idle map with rider's location */}
          {Platform.OS === 'web' ? (
            <View style={styles.fullScreenMap}>
              <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            </View>
          ) : (
            <View style={styles.fullScreenMap}>
              <Text>Map available on web only</Text>
            </View>
          )}

          {/* Location Card - At Top */}
          <View style={styles.locationCard}>
            <View style={styles.locationCardHeader}>
              <View style={styles.locationCardTextContainer}>
                <Text style={styles.locationCardTitle}>Current Location</Text>
                <Text style={styles.locationCardAddress} numberOfLines={1}>
                  {userLocation 
                    ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}` 
                    : 'Loading location...'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.searchLocationButton}
                onPress={() => {
                  Alert.alert('Change Location', 'Use GPS or search for a new location');
                }}
              >
                <Ionicons name="search" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Job Notification Modal */}
          {pendingJobNotification && (
            <Modal
              visible={true}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setPendingJobNotification(null)}
            >
              <View style={styles.jobNotificationOverlay}>
                <View style={styles.jobNotificationCard}>
                  <View style={styles.jobNotificationHeader}>
                    <Text style={styles.jobNotificationFee}>
                      ₱{(pendingJobNotification.data.total_amount * 0.10).toFixed(2)}
                    </Text>
                    <Text style={styles.jobNotificationFeeLabel}>Delivery Fee</Text>
                  </View>

                  <View style={styles.jobNotificationBody}>
                    <View style={styles.jobNotificationLocation}>
                      <View style={styles.jobNotificationLocationIcon}>
                        <Ionicons name="restaurant" size={24} color="#210059" />
                      </View>
                      <View style={styles.jobNotificationLocationInfo}>
                        <Text style={styles.jobNotificationLocationTitle}>Pick-up</Text>
                        <Text style={styles.jobNotificationLocationAddress}>
                          {pendingJobNotification.data.restaurant_name}
                        </Text>
                        <Text style={styles.jobNotificationLocationTime}>
                          {pendingJobNotification.data.restaurant_location?.address || 'Restaurant address'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.jobNotificationDivider} />

                    <View style={styles.jobNotificationLocation}>
                      <View style={styles.jobNotificationLocationIcon}>
                        <Ionicons name="home" size={24} color="#4CAF50" />
                      </View>
                      <View style={styles.jobNotificationLocationInfo}>
                        <Text style={styles.jobNotificationLocationTitle}>Drop-off</Text>
                        <Text style={styles.jobNotificationLocationAddress}>
                          {pendingJobNotification.data.customer_name}
                        </Text>
                        <Text style={styles.jobNotificationLocationTime}>
                          {pendingJobNotification.data.delivery_address?.address || 'Customer address'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.jobNotificationAcceptButton}
                    onPress={() => {
                      setPendingJobNotification(null);
                      setIsNavigating(true);
                    }}
                  >
                    <Text style={styles.jobNotificationAcceptText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </SafeAreaView>
      </Animated.View>
    );
  };

  // Render active navigation screen (has job AND navigation started)
  const renderActiveScreen = () => {
    console.log('➡️ Rendering ACTIVE NAVIGATION screen with map and route for job:', currentJob.data?.id);

    const deliveryFee = currentJob.data.total_amount ? (currentJob.data.total_amount * 0.10).toFixed(0) : '0';
    const orderStatus = currentJob.data.status;

    return (
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Full-screen Map */}
        {Platform.OS === 'web' ? (
          <View style={styles.fullScreenMap}>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          </View>
        ) : (
          <View style={styles.fullScreenMap}>
            <Text>Map available on web only</Text>
          </View>
        )}

        {/* Modern Google Maps Navigation Features */}
        {Platform.OS === 'web' && (
          <>
            {/* 13. Progress Bar */}
            <ProgressBar progress={routeProgress} />

            {/* 1. ETA & Distance Display */}
            <ETADisplay 
              eta={etaToDestination || 'Calculating...'} 
              distance={distanceToDestination || 'Calculating...'}
            />

            {/* 9. Lane Guidance */}
            {currentStep?.lanes && (
              <LaneGuidance laneInfo={currentStep.lanes} />
            )}

            {/* 6. Recenter Button */}
            <RecenterButton
              onPress={() => {
                console.log('🎯 Recenter button clicked - Enabling 3D Navigation View');
                
                if (mapInstanceRef.current && userLocation) {
                  const google = (window as any).google;
                  if (google && google.maps) {
                    const position = new google.maps.LatLng(
                      userLocation.latitude,
                      userLocation.longitude
                    );
                    
                    // Re-enable auto-centering
                    autoRecenterRef.current = true;
                    console.log('✅ Auto-follow re-enabled');
                    
                    // INSTANT center to current position
                    mapInstanceRef.current.setCenter(position);
                    
                    // Set navigation zoom level
                    mapInstanceRef.current.setZoom(18);
                    
                    // ENABLE 3D NAVIGATION VIEW - Tilt camera to 45 degrees (bird's eye view)
                    if (mapInstanceRef.current.setTilt) {
                      mapInstanceRef.current.setTilt(45);
                      console.log('✅ Camera tilt set to 45° (3D view)');
                    }
                    
                    // ROTATE MAP - Arrow points upward (following lane direction)
                    // Calculate heading from movement or use current bearing
                    let heading = currentBearing;
                    
                    // If we have GPS heading from device, use that (most accurate)
                    if (userLocation.heading !== null && userLocation.heading !== undefined) {
                      heading = userLocation.heading;
                    }
                    
                    // Rotate map so arrow points upward in direction of travel
                    if (mapInstanceRef.current.setHeading && heading !== 0) {
                      mapInstanceRef.current.setHeading(heading);
                      console.log(`✅ Map rotated to heading: ${heading.toFixed(0)}° (arrow points up)`);
                    }
                    
                    console.log('🎯 3D Navigation View ACTIVATED - Just like Google Maps!');
                  }
                }
              }}
            />
          </>
        )}

        {/* Draggable Bottom Sheet for Active Navigation */}
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={['15%', '40%', '70%']}
          enablePanDownToClose={false}
          handleIndicatorStyle={{ backgroundColor: '#DDD' }}
          backgroundStyle={{ backgroundColor: '#FFF' }}
        >
          <BottomSheetScrollView style={styles.bottomSheetContent}>
            <View style={styles.activeNavHeader}>
              <Ionicons name="navigate-circle" size={32} color="#210059" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.activeNavTitle}>
                  {currentJob.type === 'order' ? 'Food Delivery' : 'Ride Service'}
                </Text>
                <Text style={styles.activeNavSubtitle}>
                  {currentJob.data.restaurant_name || currentJob.data.customer_name}
                </Text>
              </View>
              <View style={styles.deliveryFeeBadge}>
                <Text style={styles.deliveryFeeBadgeText}>₱{deliveryFee}</Text>
              </View>
            </View>

            <View style={styles.activeNavDivider} />

            {/* Show different content based on status */}
            {(orderStatus === 'accepted' || orderStatus === 'rider_assigned') ? (
              // Status: Ready for pickup
              <>
                <View style={styles.activeNavInfoRow}>
                  <Ionicons name="restaurant" size={20} color="#666" />
                  <Text style={styles.activeNavInfoText}>Pick up from restaurant</Text>
                </View>
                <View style={styles.activeNavInfoRow}>
                  <Ionicons name="location" size={20} color="#666" />
                  <Text style={styles.activeNavInfoText}>
                    {currentJob.data.restaurant_location?.address || 'Restaurant location'}
                  </Text>
                </View>
                <View style={styles.activeNavInfoRow}>
                  <Ionicons name="time" size={20} color="#666" />
                  <Text style={styles.activeNavInfoText}>
                    ETA: {etaToDestination || 'Calculating...'}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={styles.markPickedUpButton}
                  onPress={async () => {
                    try {
                      // Update order status to picked_up
                      await api.put(`/orders/${currentJob.data.id}/status`, { status: 'picked_up' });
                      
                      // Refresh the job
                      await fetchCurrentJob();
                      
                      // Draw new route from rider to customer
                      if (mapInstanceRef.current && userLocation && currentJob.data.delivery_address) {
                        const origin = {
                          lat: userLocation.latitude,
                          lng: userLocation.longitude
                        };
                        const destination = {
                          lat: currentJob.data.delivery_address.latitude,
                          lng: currentJob.data.delivery_address.longitude
                        };
                        
                        // Draw the new route to customer
                        fetchRouteFromDirectionsAPI(origin, destination, mapInstanceRef.current);
                        
                        // Re-center map to show both rider and customer
                        const google = (window as any).google;
                        if (google && google.maps) {
                          const bounds = new google.maps.LatLngBounds();
                          bounds.extend(origin);
                          bounds.extend(destination);
                          mapInstanceRef.current.fitBounds(bounds);
                        }
                      }
                    } catch (error) {
                      Alert.alert('Error', 'Failed to update order status');
                    }
                  }}
                >
                  <Ionicons name="checkmark-done" size={22} color="#FFF" />
                  <Text style={styles.markPickedUpText}>Mark Picked Up</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Status: Picked up / Out for delivery
              <>
                <View style={styles.activeNavInfoRow}>
                  <Ionicons name="bicycle" size={20} color="#4CAF50" />
                  <Text style={[styles.activeNavInfoText, { color: '#4CAF50', fontWeight: '600' }]}>
                    Order picked up - Delivering now
                  </Text>
                </View>
                <View style={styles.activeNavInfoRow}>
                  <Ionicons name="home" size={20} color="#666" />
                  <Text style={styles.activeNavInfoText}>
                    {currentJob.data.delivery_address?.address || 'Delivery address'}
                  </Text>
                </View>
                <View style={styles.activeNavStats}>
                  <View style={styles.activeNavStatItem}>
                    <Text style={styles.activeNavStatLabel}>Distance</Text>
                    <Text style={styles.activeNavStatValue}>{distanceToDestination || '--'}</Text>
                  </View>
                  <View style={styles.activeNavStatDivider} />
                  <View style={styles.activeNavStatItem}>
                    <Text style={styles.activeNavStatLabel}>ETA</Text>
                    <Text style={styles.activeNavStatValue}>{etaToDestination || '--'}</Text>
                  </View>
                  <View style={styles.activeNavStatDivider} />
                  <View style={styles.activeNavStatItem}>
                    <Text style={styles.activeNavStatLabel}>Fee</Text>
                    <Text style={styles.activeNavStatValue}>₱{deliveryFee}</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.completeDeliveryButton}
                  onPress={async () => {
                    try {
                      console.log('🎯 Complete Delivery button clicked');
                      console.log('Current delivery fee:', deliveryFee);
                      
                      // Save delivery fee before completing
                      setCompletedDeliveryFee(deliveryFee);
                      
                      // Update order status to delivered
                      console.log('📤 Updating order status to delivered...');
                      await api.put(`/orders/${currentJob.data.id}/status`, { status: 'delivered' });
                      console.log('✅ Order status updated successfully');
                      
                      // Clear pending notification
                      setPendingJobNotification(null);
                      
                      // Show congratulations card
                      console.log('🎉 Setting showCongrats to TRUE');
                      setShowCongrats(true);
                      console.log('State updated - showCongrats should now be true');
                      
                      // Reset navigation state
                      setIsNavigating(false);
                      
                      // IMPORTANT: Delay fetchCurrentJob to let congratulations modal render first
                      setTimeout(async () => {
                        console.log('⏰ Refreshing job status after showing congrats...');
                        await fetchCurrentJob();
                      }, 500); // Small delay to ensure modal renders
                      
                      // Auto-hide congrats after 5 seconds and then refresh job
                      setTimeout(() => {
                        console.log('⏰ Auto-hiding congrats card');
                        setShowCongrats(false);
                      }, 5000);
                    } catch (error) {
                      console.error('❌ Error completing delivery:', error);
                      Alert.alert('Error', 'Failed to complete delivery');
                    }
                  }}
                >
                  <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                  <Text style={styles.completeDeliveryText}>Complete Delivery</Text>
                </TouchableOpacity>
              </>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </SafeAreaView>
    </GestureHandlerRootView>
    </Animated.View>
  );
  };

  // Main component logic - decide which screen to render and show congratulations overlay
  const currentScreen = (!currentJob || !isNavigating) ? renderIdleScreen() : renderActiveScreen();

  return (
    <>
      {currentScreen}
      {showCongrats && (
        <View style={styles.congratsOverlay}>
          <View style={styles.congratsCard}>
            <View style={styles.congratsIconContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            </View>
            <Text style={styles.congratsTitle}>Delivery Completed! 🎉</Text>
            <Text style={styles.congratsMessage}>
              Great job! You've successfully completed the delivery.
            </Text>
            <View style={styles.congratsEarnings}>
              <Text style={styles.congratsEarningsLabel}>You earned</Text>
              <Text style={styles.congratsEarningsAmount}>₱{completedDeliveryFee}</Text>
            </View>
            <TouchableOpacity
              style={styles.congratsButton}
              onPress={async () => {
                console.log('👆 Continue button clicked - clearing job and routes');
                
                // EXPLICIT route clearing as failsafe
                if (directionsRenderersRef.current?.length > 0) {
                  console.log('🗑️ Explicitly clearing routes from Continue button');
                  directionsRenderersRef.current.forEach(renderer => {
                    if (renderer) {
                      renderer.setMap(null);
                    }
                  });
                  directionsRenderersRef.current = [];
                }
                
                setShowCongrats(false);
                setCurrentJob(null); // Clear the completed job
                setCompletedDeliveryFee('0'); // Reset delivery fee
                
                // Wait 100ms for useEffect to execute before fetching
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Fetch nearby orders to show available deliveries
                console.log('🔍 Fetching nearby orders...');
                await fetchNearbyOrders();
              }}
            >
              <Text style={styles.congratsButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}
// Wrapper component to prevent hooks violation when non-riders access this screen
export default function RiderNavigationScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();

  // Handle auth loading state
  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#210059" />
        </View>
      </SafeAreaView>
    );
  }

  // Handle non-rider access - prevents hooks violation by not rendering inner component
  if (user && user.role !== 'rider') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed" size={80} color="#210059" />
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

  // Render the full navigation component for riders
  return <RiderNavigationContent />;
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
    color: '#210059',
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
    backgroundColor: '#210059',
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
  idleSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  idleSheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  idleSheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  idleInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  idleInfoText: {
    flex: 1,
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  locationCard: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 30,
  },
  locationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationCardTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  locationCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  locationCardAddress: {
    fontSize: 12,
    color: '#666',
  },
  searchLocationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#210059',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#210059',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 20,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
    outlineStyle: 'none',
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 12,
  },
  searchResultText: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  searchResultDescription: {
    fontSize: 14,
    color: '#666',
  },
  emptySearchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptySearchText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  modalFooter: {
    padding: 20,
    paddingTop: 10,
  },
  useCurrentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#210059',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  useCurrentLocationText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editLocationButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 100,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  backButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  simpleJobInfo: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  simpleJobTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  simpleJobStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  simpleJobDistance: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  jobCardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  jobCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  jobCardHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  jobCardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  jobCardDetails: {
    marginBottom: 24,
  },
  jobCardLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  jobCardValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  startNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#210059',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  startNavigationText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  availableOrdersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    gap: 12,
  },
  availableOrdersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#210059',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderRestaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  orderRestaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deliveryFeeTag: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  deliveryFeeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  orderDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderDetailText: {
    fontSize: 14,
    color: '#666',
  },
  orderDestination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  orderDestinationText: {
    fontSize: 13,
    color: '#999',
    flex: 1,
  },
  markPickupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#210059',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  markPickupText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  noOrdersContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noOrdersText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    fontWeight: '600',
  },
  noOrdersSubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 4,
  },
  activeNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
  },
  activeNavTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  activeNavSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  deliveryFeeBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  deliveryFeeBadgeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeNavDivider: {
    height: 1,
    backgroundColor: '#EEE',
    marginBottom: 16,
  },
  activeNavInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  activeNavInfoText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  markPickedUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  markPickedUpText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeNavStats: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  activeNavStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  activeNavStatLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  activeNavStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  activeNavStatDivider: {
    width: 1,
    backgroundColor: '#DDD',
    marginHorizontal: 12,
  },
  completeDeliveryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  completeDeliveryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  congratsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  congratsCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 32,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  congratsIconContainer: {
    marginBottom: 20,
  },
  congratsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  congratsMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  congratsEarnings: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  congratsEarningsLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  congratsEarningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  congratsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#210059',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    gap: 8,
  },
  congratsButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  newOrderBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#210059',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
    shadowColor: '#210059',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  newOrderBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  acceptedJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 16,
  },
  acceptedJobTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  acceptedJobCard: {
    backgroundColor: '#F9FFF9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  acceptedJobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  acceptedJobLabel: {
    fontSize: 14,
    color: '#666',
  },
  acceptedJobValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  acceptedJobFee: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  startNavigationButtonBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#210059',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  startNavigationTextBottom: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  jobNotificationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  jobNotificationCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  jobNotificationHeader: {
    alignItems: 'center',
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 20,
  },
  jobNotificationFee: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  jobNotificationFeeLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  jobNotificationBody: {
    marginBottom: 24,
  },
  jobNotificationLocation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  jobNotificationLocationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  jobNotificationLocationInfo: {
    flex: 1,
  },
  jobNotificationLocationTitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  jobNotificationLocationAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  jobNotificationLocationTime: {
    fontSize: 14,
    color: '#666',
  },
  jobNotificationDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
  },
  jobNotificationAcceptButton: {
    backgroundColor: '#210059',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  jobNotificationAcceptText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
