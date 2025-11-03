import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

export default function RiderNavigationScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  
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
    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchCurrentJob();
      getUserLocation();
    }, 10000);
    
    // Send location updates every 5 seconds when rider has active job
    const locationInterval = setInterval(() => {
      if (userLocation && currentJob) {
        updateRiderLocation();
      }
    }, 5000);
    
    return () => {
      clearInterval(interval);
      clearInterval(locationInterval);
    };
  }, [currentJob, userLocation]);

  useEffect(() => {
    if (currentJob && Platform.OS === 'web') {
      loadMap();
    }
  }, [currentJob, userLocation]);

  const getUserLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to Manila if location not available
          setUserLocation({
            latitude: 14.5995,
            longitude: 120.9842,
          });
        }
      );
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
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
    if (!currentJob || !userLocation) {
      console.error('❌ Missing data for map initialization', { currentJob: !!currentJob, userLocation: !!userLocation });
      return;
    }

    console.log('✅ Initializing map with:', { currentJob: currentJob.type, userLocation });

    // Helper function to safely parse coordinates
    const parseCoordinate = (value: any): number | null => {
      if (typeof value === 'number' && !isNaN(value)) return value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    };

    const map = new google.maps.Map(mapRef.current, {
      center: userLocation,
      zoom: 14,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    setMapLoaded(true);
    console.log('✅ Map initialized successfully');

    // Current location marker (rider)
    new google.maps.Marker({
      position: userLocation,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#2196F3',
        fillOpacity: 1,
        strokeColor: '#FFF',
        strokeWeight: 3,
      },
      title: 'Your Location',
    });

    let pickupLocation, dropoffLocation;

    if (currentJob.type === 'order') {
      // Food delivery: Restaurant = pickup, Customer = dropoff
      const restaurantLocation = currentJob.data.restaurant_location;
      const deliveryLocation = currentJob.data.delivery_address;
      
      if (restaurantLocation) {
        const lat = parseCoordinate(restaurantLocation.latitude);
        const lng = parseCoordinate(restaurantLocation.longitude);
        
        if (lat !== null && lng !== null) {
          pickupLocation = { lat, lng };
          
          // Restaurant marker (pickup)
          new google.maps.Marker({
            position: pickupLocation,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
            fillColor: '#4CAF50',
            fillOpacity: 1,
            strokeColor: '#FFF',
            strokeWeight: 2,
          },
          title: 'Pickup: ' + currentJob.data.restaurant_name,
        });
      }

      if (deliveryLocation) {
        dropoffLocation = {
          lat: deliveryLocation.latitude,
          lng: deliveryLocation.longitude,
        };
        
        // Customer marker (dropoff)
        new google.maps.Marker({
          position: dropoffLocation,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#FF6B6B',
            fillOpacity: 1,
            strokeColor: '#FFF',
            strokeWeight: 2,
          },
          title: 'Dropoff: ' + currentJob.data.customer_name,
        });
      }
    } else {
      // Moto-taxi: Customer pickup, Destination dropoff
      const pickup = currentJob.data.pickup_location;
      const dropoff = currentJob.data.dropoff_location;
      
      if (pickup) {
        pickupLocation = {
          lat: pickup.latitude,
          lng: pickup.longitude,
        };
        
        new google.maps.Marker({
          position: pickupLocation,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#4CAF50',
            fillOpacity: 1,
            strokeColor: '#FFF',
            strokeWeight: 2,
          },
          title: 'Pickup: ' + currentJob.data.customer_name,
        });
      }

      if (dropoff) {
        dropoffLocation = {
          lat: dropoff.latitude,
          lng: dropoff.longitude,
        };
        
        new google.maps.Marker({
          position: dropoffLocation,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#FF6B6B',
            fillOpacity: 1,
            strokeColor: '#FFF',
            strokeWeight: 2,
          },
          title: 'Dropoff: ' + dropoff.address,
        });
      }
    }

    // Draw route
    if (pickupLocation || dropoffLocation) {
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2196F3',
          strokeWeight: 4,
        },
      });

      const origin = userLocation;
      const destination = currentJob.data.status === 'picked_up' || currentJob.data.status === 'out_for_delivery'
        ? dropoffLocation
        : pickupLocation;

      if (destination) {
        directionsService.route(
          {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === 'OK') {
              directionsRenderer.setDirections(result);
              // Extract distance and ETA
              const leg = result.routes[0].legs[0];
              setDistanceToDestination(leg.distance.text);
              setEtaToDestination(leg.duration.text);
            }
          }
        );
      }
    }

    // Fit bounds to show all markers
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(userLocation);
    if (pickupLocation) bounds.extend(pickupLocation);
    if (dropoffLocation) bounds.extend(dropoffLocation);
    map.fitBounds(bounds);
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
    <SafeAreaView style={styles.container}>
      {/* Map */}
      {Platform.OS === 'web' ? (
        <View style={styles.mapContainer}>
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
          {Platform.OS === 'web' && (
            <div 
              ref={mapRef} 
              style={{ 
                width: '100%', 
                height: '100%',
                display: mapLoaded ? 'block' : 'none',
                position: 'absolute',
                top: 0,
                left: 0,
              }} 
            />
          )}
        </View>
      ) : (
        <View style={[styles.mapContainer, styles.mapPlaceholder]}>
          <Ionicons name="map" size={64} color="#CCC" />
          <Text style={styles.mapPlaceholderText}>Map available on web</Text>
        </View>
      )}

      {/* Job Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View>
            <Text style={styles.jobType}>
              {currentJob.type === 'order' ? '🍔 Food Delivery' : '🏍️ Moto-Taxi Ride'}
            </Text>
            <Text style={styles.jobTitle}>
              {currentJob.type === 'order' 
                ? currentJob.data.restaurant_name 
                : currentJob.data.customer_name}
            </Text>
          </View>
          <View style={styles.amountBadge}>
            <Text style={styles.amountText}>
              ₱{currentJob.type === 'order' 
                ? currentJob.data.total_amount.toFixed(2)
                : currentJob.data.actual_fare.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.locationInfo}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={20} color="#4CAF50" />
            <Text style={styles.locationText}>
              {currentJob.type === 'order'
                ? currentJob.data.restaurant_location?.address || 'Restaurant'
                : currentJob.data.pickup_location?.address || 'Pickup'}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={20} color="#FF6B6B" />
            <Text style={styles.locationText}>
              {currentJob.type === 'order'
                ? currentJob.data.delivery_address?.address
                : currentJob.data.dropoff_location?.address}
            </Text>
          </View>
          {distanceToDestination && etaToDestination && (
            <View style={styles.etaCard}>
              <View style={styles.etaItem}>
                <Ionicons name="navigate" size={20} color="#2196F3" />
                <Text style={styles.etaLabel}>{distanceToDestination}</Text>
              </View>
              <View style={styles.etaDivider} />
              <View style={styles.etaItem}>
                <Ionicons name="time" size={20} color="#2196F3" />
                <Text style={styles.etaLabel}>ETA: {etaToDestination}</Text>
              </View>
            </View>
          )}
        </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
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
