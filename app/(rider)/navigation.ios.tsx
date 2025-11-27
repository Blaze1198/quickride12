import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, Camera } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { RecenterButton } from '../../components/NavigationFeatures';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = 'AIzaSyA0m1oRlXLQWjxacqjEJ6zJW3WvmOWvQkQ';

export default function RiderNavigationScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();
  const mapRef = useRef<MapView>(null);
  
  // State
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [heading, setHeading] = useState<number>(0);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [distanceToDestination, setDistanceToDestination] = useState<string>('');
  const [etaToDestination, setEtaToDestination] = useState<string>('');
  const [autoRecenter, setAutoRecenter] = useState(true);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);

  // Fetch current job
  useEffect(() => {
    if (!user || user.role !== 'rider') {
      setLoading(false);
      return;
    }

    fetchCurrentJob();
    const jobInterval = setInterval(fetchCurrentJob, 10000);

    return () => clearInterval(jobInterval);
  }, [user, authLoading]);

  // Start real-time location tracking with heading
  useEffect(() => {
    if (!user || user.role !== 'rider') return;

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [user]);

  // Send location updates to backend
  useEffect(() => {
    if (!userLocation || !user) return;

    updateRiderLocation();
  }, [userLocation, user]);

  const startLocationTracking = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for navigation');
        return;
      }

      console.log('🛰️ Starting HIGH-ACCURACY GPS tracking with heading...');

      // Start watching position with heading data
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation, // Highest accuracy with heading
          timeInterval: 1000, // Update every second
          distanceInterval: 1, // Update every meter
        },
        (location) => {
          const { latitude, longitude, speed, heading: deviceHeading, accuracy } = location.coords;

          // GPS Accuracy Filter: Only accept readings with good accuracy
          if (accuracy && accuracy > 50) {
            console.log(`⚠️ GPS accuracy too low (${accuracy.toFixed(0)}m) - waiting for better signal...`);
            return;
          }

          // Log GPS quality
          let qualityIcon = '🟢';
          if (accuracy && accuracy > 20) qualityIcon = '🟡';
          if (accuracy && accuracy > 35) qualityIcon = '🟠';

          console.log(`📍 GPS ${qualityIcon}:`, {
            lat: latitude.toFixed(6),
            lng: longitude.toFixed(6),
            heading: deviceHeading ? `${deviceHeading.toFixed(0)}°` : 'N/A',
            speed: speed ? `${(speed * 3.6).toFixed(1)} km/h` : 'N/A',
            accuracy: accuracy ? `${accuracy.toFixed(0)}m` : 'N/A',
          });

          setUserLocation({
            latitude,
            longitude,
            speed,
            accuracy,
          });

          // Set heading from device compass
          if (deviceHeading !== null && deviceHeading !== undefined) {
            setHeading(deviceHeading);
          }

          // Check if user is off route (>50m) and recalculate
          if (routeCoordinates.length > 0) {
            checkRouteDeviation(latitude, longitude);
          }
        }
      );

      setLocationSubscription(subscription);
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
    }
  };

  const checkRouteDeviation = (currentLat: number, currentLng: number) => {
    if (routeCoordinates.length === 0) return;

    // Calculate distance to closest point on route
    let minDistance = Infinity;

    routeCoordinates.forEach((coord) => {
      const distance = getDistanceBetweenPoints(
        currentLat,
        currentLng,
        coord.latitude,
        coord.longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
      }
    });

    // If more than 50 meters off route, trigger recalculation
    if (minDistance > 50) {
      console.log(`🔄 REROUTING! Distance from route: ${minDistance.toFixed(0)}m`);
      // Route will automatically recalculate via MapViewDirections onReady
    }
  };

  // Haversine formula to calculate distance between two points
  const getDistanceBetweenPoints = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const fetchCurrentJob = async () => {
    if (!user || user.role !== 'rider') {
      setCurrentJob(null);
      setLoading(false);
      return;
    }

    try {
      const orderResponse = await api.get('/rider/current-order');
      
      if (orderResponse.data) {
        setCurrentJob({ type: 'order', data: orderResponse.data });
        setLoading(false);
        return;
      }

      const rideResponse = await api.get('/rider/current-ride');
      
      if (rideResponse.data) {
        setCurrentJob({ type: 'ride', data: rideResponse.data });
        setLoading(false);
        return;
      }

      setCurrentJob(null);
      setLoading(false);
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 401) {
        setCurrentJob(null);
      }
      setLoading(false);
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
    } catch (error) {
      console.error('❌ Error updating location:', error);
    }
  };

  const handleRecenter = () => {
    console.log('🎯 Recenter button clicked - Enabling 3D Navigation View');
    
    if (mapRef.current && userLocation) {
      // Re-enable auto-centering
      setAutoRecenter(true);

      // Animate to user location with 3D view
      const camera: Camera = {
        center: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        pitch: 45, // 45° tilt for 3D view
        heading: heading, // Rotate map so arrow points up
        zoom: 18, // Close zoom for navigation
        altitude: 1000,
      };

      mapRef.current.animateCamera(camera, { duration: 1000 });
      console.log('✅ 3D Navigation View activated - Map tilted to 45°, heading:', heading.toFixed(0));
    }
  };

  // Get destination based on order status
  const getDestination = () => {
    if (!currentJob || !currentJob.data) return null;

    const status = currentJob.data.status;
    const { restaurant_location, customer_location } = currentJob.data;

    if (status === 'picked_up' && customer_location) {
      return {
        latitude: customer_location.latitude,
        longitude: customer_location.longitude,
      };
    }

    if (restaurant_location) {
      return {
        latitude: restaurant_location.latitude,
        longitude: restaurant_location.longitude,
      };
    }

    return null;
  };

  const destination = getDestination();

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentJob) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="bicycle" size={64} color="#ccc" />
          <Text style={styles.noJobText}>No active deliveries</Text>
          <Text style={styles.noJobSubtext}>Waiting for orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Map View with Google Provider */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={
          userLocation
            ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            : undefined
        }
        showsUserLocation={false} // We'll use custom marker
        showsMyLocationButton={false}
        showsCompass={true}
        showsTraffic={false}
        pitchEnabled={true} // Enable 3D tilt
        rotateEnabled={true} // Enable rotation
        zoomEnabled={true}
        scrollEnabled={true}
        onPanDrag={() => {
          // Disable auto-recenter when user manually pans
          setAutoRecenter(false);
        }}
      >
        {/* Rider Marker with Heading Rotation */}
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            rotation={heading} // Rotate based on device heading
            flat={true} // Keep marker flat on map (rotates with map)
            anchor={{ x: 0.5, y: 0.5 }} // Center anchor point
          >
            <View style={styles.riderMarker}>
              <Ionicons name="navigate" size={32} color="#4285F4" />
            </View>
          </Marker>
        )}

        {/* Destination Marker */}
        {destination && (
          <Marker
            coordinate={destination}
            title={currentJob.data.status === 'picked_up' ? 'Customer' : 'Restaurant'}
          >
            <View style={styles.destinationMarker}>
              <Ionicons
                name={currentJob.data.status === 'picked_up' ? 'home' : 'restaurant'}
                size={32}
                color="#4CAF50"
              />
            </View>
          </Marker>
        )}

        {/* Route Directions */}
        {userLocation && destination && (
          <MapViewDirections
            origin={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            destination={destination}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={6}
            strokeColor="#4285F4"
            optimizeWaypoints={true}
            mode="DRIVING"
            onReady={(result) => {
              console.log(`📍 Route: ${result.distance.toFixed(1)}km, ETA: ${Math.ceil(result.duration)}min`);
              
              setDistanceToDestination(`${result.distance.toFixed(1)} km`);
              setEtaToDestination(`${Math.ceil(result.duration)} min`);
              setRouteCoordinates(result.coordinates);

              // Auto-fit map to show entire route on first load
              if (autoRecenter && mapRef.current) {
                mapRef.current.fitToCoordinates(result.coordinates, {
                  edgePadding: {
                    top: 100,
                    right: 50,
                    bottom: 300,
                    left: 50,
                  },
                  animated: true,
                });
              }
            }}
            onError={(error) => {
              console.error('❌ MapViewDirections error:', error);
            }}
          />
        )}
      </MapView>

      {/* ETA Display */}
      <View style={styles.etaContainer}>
        <View style={styles.etaContent}>
          <Ionicons name="time-outline" size={20} color="#FFF" />
          <Text style={styles.etaText}>{etaToDestination || 'Calculating...'}</Text>
          <Text style={styles.etaDivider}>•</Text>
          <Ionicons name="navigate-outline" size={20} color="#FFF" />
          <Text style={styles.etaText}>{distanceToDestination || 'Calculating...'}</Text>
        </View>
      </View>

      {/* Recenter Button */}
      <RecenterButton onPress={handleRecenter} />

      {/* Job Info Card */}
      <View style={styles.jobCard}>
        <View style={styles.jobHeader}>
          <Ionicons
            name={currentJob.data.status === 'picked_up' ? 'home' : 'restaurant'}
            size={24}
            color="#4285F4"
          />
          <Text style={styles.jobTitle}>
            {currentJob.data.status === 'picked_up'
              ? `Deliver to ${currentJob.data.customer_name}`
              : `Pick up from ${currentJob.data.restaurant_name}`}
          </Text>
        </View>
        <Text style={styles.jobAddress}>
          {currentJob.data.status === 'picked_up'
            ? currentJob.data.delivery_address?.address || 'Customer address'
            : currentJob.data.restaurant_location?.address || 'Restaurant address'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  map: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noJobText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  noJobSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  riderMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4285F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  destinationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  etaContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  etaContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  etaText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  etaDivider: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    marginHorizontal: 4,
  },
  jobCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 5,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  jobAddress: {
    fontSize: 14,
    color: '#666',
    marginLeft: 32,
  },
});
