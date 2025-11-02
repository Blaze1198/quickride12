import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import Constants from 'expo-constants';

interface Order {
  id: string;
  customer_name: string;
  restaurant_name: string;
  status: string;
  delivery_address: {
    latitude: number;
    longitude: number;
    address: string;
  };
  restaurant_location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  rider_location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

interface LiveOrdersMapProps {
  orders: Order[];
}

export default function LiveOrdersMap({ orders }: LiveOrdersMapProps) {
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey || 
                   process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setError('Google Maps API key not found');
      return;
    }

    // Load Google Maps script
    const loadGoogleMaps = () => {
      if (typeof window !== 'undefined' && (window as any).google) {
        initializeMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => initializeMap();
      script.onerror = () => setError('Failed to load Google Maps');
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      const google = (window as any).google;
      if (!google || !mapRef.current) return;

      // Default center (Philippines)
      const center = { lat: 14.5995, lng: 120.9842 };

      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom: 12,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });

      setMapLoaded(true);

      // Add markers for orders
      orders.forEach((order) => {
        // Restaurant marker (green)
        if (order.restaurant_location) {
          new google.maps.Marker({
            position: {
              lat: order.restaurant_location.latitude,
              lng: order.restaurant_location.longitude,
            },
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#4CAF50',
              fillOpacity: 1,
              strokeColor: '#FFF',
              strokeWeight: 2,
            },
            title: `Restaurant: ${order.restaurant_name}`,
          });
        }

        // Customer delivery marker (red)
        if (order.delivery_address) {
          new google.maps.Marker({
            position: {
              lat: order.delivery_address.latitude,
              lng: order.delivery_address.longitude,
            },
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#FF6B6B',
              fillOpacity: 1,
              strokeColor: '#FFF',
              strokeWeight: 2,
            },
            title: `Deliver to: ${order.customer_name}`,
          });
        }

        // Rider marker (blue) if assigned
        if (order.rider_location) {
          new google.maps.Marker({
            position: {
              lat: order.rider_location.latitude,
              lng: order.rider_location.longitude,
            },
            map,
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 5,
              fillColor: '#2196F3',
              fillOpacity: 1,
              strokeColor: '#FFF',
              strokeWeight: 2,
            },
            title: `Rider en route`,
          });
        }
      });

      // Auto-fit bounds if there are orders
      if (orders.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        orders.forEach((order) => {
          if (order.restaurant_location) {
            bounds.extend({
              lat: order.restaurant_location.latitude,
              lng: order.restaurant_location.longitude,
            });
          }
          if (order.delivery_address) {
            bounds.extend({
              lat: order.delivery_address.latitude,
              lng: order.delivery_address.longitude,
            });
          }
          if (order.rider_location) {
            bounds.extend({
              lat: order.rider_location.latitude,
              lng: order.rider_location.longitude,
            });
          }
        });
        map.fitBounds(bounds);
      }
    };

    loadGoogleMaps();
  }, [orders]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Map view only available on web</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {!mapLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6B6B" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>Restaurant</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
          <Text style={styles.legendText}>Customer</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
          <Text style={styles.legendText}>Rider</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F5F5F5',
  },
  message: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#F44336',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  legend: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#333',
  },
});
