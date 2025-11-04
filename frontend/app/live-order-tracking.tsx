import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import api from '../utils/api';

interface Order {
  id: string;
  restaurant_name: string;
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

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [riderLocation, setRiderLocation] = useState<any>(null);
  const [distance, setDistance] = useState<string>('');
  const [eta, setEta] = useState<string>('');
  const [mapError, setMapError] = useState<string>('');
  const [scriptLoaded, setScriptLoaded] = useState(false);

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
      setLoading(false);
    } catch (error) {
      console.error('Error fetching order:', error);
      setLoading(false);
    }
  };

  const fetchRiderLocation = async () => {
    try {
      const response = await api.get(`/orders/${orderId}/rider-location`);
      if (response.data.rider_assigned && response.data.location) {
        setRiderLocation(response.data.location);
        // Calculate distance and ETA if we have both locations
        if (order?.delivery_address && response.data.location) {
          calculateDistanceAndETA(response.data.location, order.delivery_address);
        }
      }
    } catch (error) {
      console.error('Error fetching rider location:', error);
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

    // Delivery location marker (Customer - Red)
    if (order.delivery_address) {
      new google.maps.Marker({
        position: {
          lat: order.delivery_address.latitude,
          lng: order.delivery_address.longitude,
        },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#FF6B6B',
          fillOpacity: 1,
          strokeColor: '#FFF',
          strokeWeight: 3,
        },
        title: 'Your Location',
        label: {
          text: '🏠',
          fontSize: '20px',
        }
      });
    }

    // Rider marker (Real-time location - Blue)
    if (riderLocation) {
      const riderMarker = new google.maps.Marker({
        position: {
          lat: riderLocation.latitude,
          lng: riderLocation.longitude,
        },
        map,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: '#2196F3',
          fillOpacity: 1,
          strokeColor: '#FFF',
          strokeWeight: 2,
          rotation: riderLocation.heading || 0,
        },
        title: `Rider: ${order.rider_name || 'On the way'}`,
        animation: google.maps.Animation.DROP,
      });

      // Draw route from rider to customer using Routes API
      const drawRoute = async () => {
        try {
          const apiKey = 'AIzaSyA0m1oRlXLQWjxacqjEJ6zJW3WvmOWvQkQ';
          const origin = `${riderLocation.latitude},${riderLocation.longitude}`;
          const destination = `${order.delivery_address.latitude},${order.delivery_address.longitude}`;
          
          console.log('🗺️ Fetching route from rider to customer...');
          
          // Use Google Maps Routes API (REST)
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
                      latitude: order.delivery_address.latitude,
                      longitude: order.delivery_address.longitude
                    }
                  }
                },
                travelMode: 'DRIVE',
                routingPreference: 'TRAFFIC_AWARE'
              })
            }
          );

          if (!response.ok) {
            console.error('❌ Routes API error:', response.status);
            return;
          }

          const data = await response.json();
          
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            console.log('✅ Route fetched successfully');
            
            // Decode polyline and draw route
            const path = google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
            
            new google.maps.Polyline({
              path: path,
              geodesic: true,
              strokeColor: '#2196F3',
              strokeOpacity: 0.8,
              strokeWeight: 4,
              map: map
            });

            // Update distance and ETA
            const distanceKm = (route.distanceMeters / 1000).toFixed(1);
            const durationMin = Math.ceil(parseInt(route.duration.replace('s', '')) / 60);
            setDistance(`${distanceKm} km`);
            setEta(`${durationMin} min`);
            
            console.log(`📍 Route: ${distanceKm}km, ETA: ${durationMin}min`);
          }
        } catch (error) {
          console.error('❌ Error drawing route:', error);
        }
      };

      drawRoute();

      // Fit bounds to show both markers
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: order.delivery_address.latitude, lng: order.delivery_address.longitude });
      bounds.extend({ lat: riderLocation.latitude, lng: riderLocation.longitude });
      map.fitBounds(bounds);
    }
  };

  // Update map with new rider location and redraw route
  const updateMapMarkers = async () => {
    console.log('🔄 Updating map with new rider location');
    
    if (!riderLocation || !order || !mapInstanceRef.current) {
      console.log('⚠️ Cannot update route - missing data');
      return;
    }

    try {
      const apiKey = 'AIzaSyA0m1oRlXLQWjxacqjEJ6zJW3WvmOWvQkQ';
      
      console.log('🗺️ Fetching updated route from rider to customer...');
      
      // Use Google Maps Routes API (REST)
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
                  latitude: order.delivery_address.latitude,
                  longitude: order.delivery_address.longitude
                }
              }
            },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE'
          })
        }
      );

      if (!response.ok) {
        console.error('❌ Routes API error:', response.status);
        return;
      }

      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        console.log('✅ Route updated successfully');
        
        // Decode polyline and draw route (this will replace the old route)
        if ((window as any).google && (window as any).google.maps && (window as any).google.maps.geometry) {
          const path = (window as any).google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
          
          new (window as any).google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#2196F3',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: mapInstanceRef.current
          });

          // Update distance and ETA
          const distanceKm = (route.distanceMeters / 1000).toFixed(1);
          const durationMin = Math.ceil(parseInt(route.duration.replace('s', '')) / 60);
          setDistance(`${distanceKm} km`);
          setEta(`${durationMin} min`);
          
          console.log(`📍 Updated route: ${distanceKm}km, ETA: ${durationMin}min`);
        }
      }
    } catch (error) {
      console.error('❌ Error updating route:', error);
    }
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: string }> = {
      pending: { label: 'Order Received', color: '#FF9800', icon: 'time' },
      paid: { label: 'Payment Confirmed', color: '#2196F3', icon: 'checkmark-circle' },
      accepted: { label: 'Restaurant Accepted', color: '#9C27B0', icon: 'restaurant' },
      preparing: { label: 'Preparing Your Food', color: '#FF6B6B', icon: 'flame' },
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
          <ActivityIndicator size="large" color="#FF6B6B" />
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Order</Text>
        <View style={{ width: 24 }} />
      </View>

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
        <View style={[styles.mapContainer, styles.mapPlaceholder]}>
          <Ionicons name="map" size={64} color="#CCC" />
          <Text style={styles.mapPlaceholderText}>Map available on web</Text>
        </View>
      )}

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={[styles.statusIndicator, { backgroundColor: statusInfo.color }]}>
          <Ionicons name={statusInfo.icon as any} size={32} color="#FFF" />
        </View>
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusLabel}>Order Status</Text>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
          {riderLocation && distance && (
            <View style={styles.distanceContainer}>
              <Ionicons name="navigate-circle" size={16} color="#2196F3" />
              <Text style={styles.distanceText}>{distance} • ETA: {eta}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Order Details */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Order Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Restaurant:</Text>
          <Text style={styles.detailValue}>{order.restaurant_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total:</Text>
          <Text style={styles.detailValue}>₱{order.total_amount.toFixed(2)}</Text>
        </View>
        {order.rider_name && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Rider:</Text>
            <Text style={styles.detailValue}>{order.rider_name}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Delivery to:</Text>
          <Text style={styles.detailValue}>{order.delivery_address?.address}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    backgroundColor: '#FF6B6B',
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
    backgroundColor: '#FF6B6B',
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
