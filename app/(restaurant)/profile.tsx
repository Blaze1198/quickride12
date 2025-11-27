import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';

interface Restaurant {
  id: string;
  name: string;
  description?: string;
  image_base64?: string;
  phone: string;
  operating_hours?: string;
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  is_open: boolean;
}

export default function RestaurantProfileScreen() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formOperatingHours, setFormOperatingHours] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formImage, setFormImage] = useState<string | null>(null);
  
  // Location modal state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tempLatitude, setTempLatitude] = useState(14.5995);
  const [tempLongitude, setTempLongitude] = useState(120.9842);
  const mapRef = useRef<any>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchRestaurant();
  }, []);

  const fetchRestaurant = async () => {
    try {
      const response = await api.get('/restaurants/owner/my');
      const data = response.data;
      setRestaurant(data);
      
      if (data) {
        setFormName(data.name || '');
        setFormDescription(data.description || '');
        setFormPhone(data.phone || '');
        setFormOperatingHours(data.operating_hours || '9:00 AM - 10:00 PM');
        setFormAddress(data.location?.address || '');
        setFormImage(data.image_base64 || null);
        
        // Set initial location
        if (data.location) {
          setTempLatitude(data.location.latitude || 14.5995);
          setTempLongitude(data.location.longitude || 120.9842);
        }
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load Google Maps and initialize
  const loadMap = () => {
    if (typeof window === 'undefined' || !Platform.OS === 'web') return;

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDJqsXxZXuu808lFZXARvy4rd0xktuqwJQ';

    if ((window as any).google && (window as any).google.maps) {
      setTimeout(() => initializeMap(), 100);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if ((window as any).google && (window as any).google.maps) {
          clearInterval(checkInterval);
          initializeMap();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setTimeout(() => {
        if ((window as any).google && (window as any).google.maps) {
          initializeMap();
        }
      }, 200);
    };
    document.head.appendChild(script);
  };

  // Initialize map with marker
  const initializeMap = () => {
    const google = (window as any).google;
    if (!google || !mapRef.current) return;

    const location = { lat: tempLatitude, lng: tempLongitude };

    const map = new google.maps.Map(mapRef.current, {
      center: location,
      zoom: 16,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
    });

    // Add draggable marker
    const marker = new google.maps.Marker({
      position: location,
      map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 20,
        fillColor: '#210059',
        fillOpacity: 1,
        strokeColor: '#FFF',
        strokeWeight: 5,
      },
      title: 'Drag to set restaurant location',
    });

    // Update coordinates when marker is dragged
    marker.addListener('dragend', (event: any) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      setTempLatitude(lat);
      setTempLongitude(lng);
      
      // Reverse geocode to get address
      reverseGeocode(lat, lng);
    });

    // Pulsing circle
    const pulsingCircle = new google.maps.Circle({
      map: map,
      center: location,
      radius: 50,
      fillColor: '#210059',
      fillOpacity: 0.15,
      strokeColor: '#210059',
      strokeOpacity: 0.5,
      strokeWeight: 2,
    });

    // Animate pulsing
    let growing = true;
    let radius = 50;
    setInterval(() => {
      if (growing) {
        radius += 3;
        if (radius >= 100) growing = false;
      } else {
        radius -= 3;
        if (radius <= 50) growing = true;
      }
      pulsingCircle.setRadius(radius);
    }, 100);

    setMapLoaded(true);
  };

  // Reverse geocode to get address
  const reverseGeocode = async (lat: number, lng: number) => {
    if (Platform.OS === 'web' && (window as any).google) {
      const google = (window as any).google;
      const geocoder = new google.maps.Geocoder();
      
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          setFormAddress(results[0].formatted_address);
        }
      });
    }
  };

  // Open location modal
  const openLocationModal = () => {
    if (restaurant?.location) {
      setTempLatitude(restaurant.location.latitude);
      setTempLongitude(restaurant.location.longitude);
    }
    setShowLocationModal(true);
    setMapLoaded(false);
    setTimeout(() => loadMap(), 300);
  };

  // Confirm location selection
  const confirmLocation = () => {
    // Update form with new location
    if (Platform.OS === 'web') {
      window.alert(`Location updated to: ${tempLatitude.toFixed(6)}, ${tempLongitude.toFixed(6)}`);
    }
    setShowLocationModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Search location using Google Places
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
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setSearchResults(results.slice(0, 5));
            setSearching(false);
          } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            setSearchResults([]);
            setSearching(false);
          } else {
            console.error('Places API error:', status);
            setSearchResults([]);
            setSearching(false);
          }
        });
      }
    } catch (error) {
      console.error('Error searching location:', error);
      setSearching(false);
    }
  };

  // Load Google Maps script
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

  // Select search result
  const selectSearchResult = async (place: any) => {
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    
    setTempLatitude(lat);
    setTempLongitude(lng);
    setFormAddress(place.formatted_address);
    setSearchQuery('');
    setSearchResults([]);
    
    // Update map center
    if (mapRef.current && (window as any).google) {
      const google = (window as any).google;
      const map = new google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 16,
      });
      
      // Re-initialize map with new location
      setTimeout(() => initializeMap(), 100);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setFormImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handleSave = async () => {
    if (!formName || !formPhone || !restaurant) {
      if (Platform.OS === 'web') {
        window.alert('Please fill in required fields');
      } else {
        alert('Please fill in required fields');
      }
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name: formName,
        description: formDescription,
        phone: formPhone,
        operating_hours: formOperatingHours,
        image_base64: formImage,
        location: {
          address: formAddress,
          latitude: tempLatitude,
          longitude: tempLongitude,
        },
      };

      await api.put(`/restaurants/${restaurant.id}`, updates);
      
      if (Platform.OS === 'web') {
        window.alert('Profile updated successfully');
      } else {
        alert('Profile updated successfully');
      }
      
      setEditing(false);
      fetchRestaurant();
    } catch (error) {
      console.error('Error updating restaurant:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to update profile');
      } else {
        alert('Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleRestaurantStatus = async () => {
    if (!restaurant) return;

    try {
      const newStatus = !restaurant.is_open;
      await api.put(`/restaurants/${restaurant.id}`, {
        is_open: newStatus,
      });
      
      if (Platform.OS === 'web') {
        window.alert(`Restaurant is now ${newStatus ? 'OPEN' : 'CLOSED'}`);
      } else {
        alert(`Restaurant is now ${newStatus ? 'OPEN' : 'CLOSED'}`);
      }
      
      fetchRestaurant();
    } catch (error) {
      console.error('Error toggling restaurant status:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#210059" />
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No restaurant found</Text>
          <Text style={styles.emptySubtext}>
            Please contact support to create your restaurant profile
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Restaurant Profile</Text>
        {!editing ? (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
            <Ionicons name="create-outline" size={20} color="#FFF" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setEditing(false);
                fetchRestaurant();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Restaurant Image */}
        <View style={styles.imageSection}>
          {formImage ? (
            <Image source={{ uri: formImage }} style={styles.restaurantImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="restaurant" size={48} color="#CCC" />
            </View>
          )}
          {editing && (
            <TouchableOpacity style={styles.changeImageButton} onPress={pickImage}>
              <Ionicons name="camera" size={20} color="#FFF" />
              <Text style={styles.changeImageText}>Change Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status Toggle */}
        <View style={styles.statusCard}>
          <View style={styles.statusInfo}>
            <View style={styles.statusHeader}>
              <Ionicons
                name={restaurant.is_open ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={restaurant.is_open ? '#4CAF50' : '#F44336'}
              />
              <Text style={styles.statusText}>
                Restaurant is {restaurant.is_open ? 'OPEN' : 'CLOSED'}
              </Text>
            </View>
            <Text style={styles.statusSubtext}>
              {restaurant.is_open
                ? 'Customers can place orders'
                : 'Orders are temporarily disabled'}
            </Text>
          </View>
          {!editing && (
            <TouchableOpacity
              style={[styles.toggleButton, restaurant.is_open && styles.toggleButtonActive]}
              onPress={toggleRestaurantStatus}
            >
              <Text style={styles.toggleButtonText}>
                {restaurant.is_open ? 'Close' : 'Open'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Form */}
        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Restaurant Name *</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="Enter restaurant name"
                placeholderTextColor="#999"
              />
            ) : (
              <Text style={styles.value}>{restaurant.name}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Tell customers about your restaurant"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            ) : (
              <Text style={styles.value}>
                {restaurant.description || 'No description'}
              </Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formPhone}
                onChangeText={setFormPhone}
                placeholder="Enter phone number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.value}>{restaurant.phone}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Operating Hours</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={formOperatingHours}
                onChangeText={setFormOperatingHours}
                placeholder="e.g., 9:00 AM - 10:00 PM"
                placeholderTextColor="#999"
              />
            ) : (
              <Text style={styles.value}>{restaurant.operating_hours}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Address</Text>
            {editing ? (
              <>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formAddress}
                  onChangeText={setFormAddress}
                  placeholder="Enter full address"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
                {Platform.OS === 'web' && (
                  <TouchableOpacity
                    style={styles.editLocationButton}
                    onPress={openLocationModal}
                  >
                    <Ionicons name="location" size={18} color="#210059" />
                    <Text style={styles.editLocationText}>Edit Location on Map</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.coordinatesDisplay}>
                  <Text style={styles.coordinatesText}>
                    📍 {tempLatitude.toFixed(6)}, {tempLongitude.toFixed(6)}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.value}>{restaurant.location.address}</Text>
                <Text style={styles.coordinatesText}>
                  📍 {restaurant.location.latitude.toFixed(6)}, {restaurant.location.longitude.toFixed(6)}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Info Cards */}
        {!editing && (
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Ionicons name="star" size={24} color="#FFB800" />
              <Text style={styles.infoLabel}>Rating</Text>
              <Text style={styles.infoValue}>{restaurant.is_open ? '4.5' : 'N/A'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Ionicons name="time-outline" size={24} color="#210059" />
              <Text style={styles.infoLabel}>Prep Time</Text>
              <Text style={styles.infoValue}>20-30 min</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Location Editor Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowLocationModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Restaurant Location</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowLocationModal(false)}
            >
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalInstructions}>
            📍 Drag the marker to your restaurant's exact location
          </Text>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a place..."
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchLocation(text);
                }}
                placeholderTextColor="#999"
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

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <View style={styles.searchResultsDropdown}>
                {searchResults.map((place, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.searchResultItem}
                    onPress={() => selectSearchResult(place)}
                  >
                    <Ionicons name="location" size={20} color="#210059" />
                    <View style={styles.searchResultTextContainer}>
                      <Text style={styles.searchResultName}>{place.name}</Text>
                      <Text style={styles.searchResultAddress} numberOfLines={1}>
                        {place.formatted_address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {searching && (
              <View style={styles.searchingIndicator}>
                <ActivityIndicator size="small" color="#210059" />
                <Text style={styles.searchingText}>Searching...</Text>
              </View>
            )}
          </View>

          {/* Map Container */}
          {Platform.OS === 'web' ? (
            <View style={styles.mapContainer}>
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
          ) : (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map" size={64} color="#CCC" />
              <Text style={styles.mapPlaceholderText}>Map available on web</Text>
            </View>
          )}

          <View style={styles.locationInfo}>
            <View style={styles.coordinatesCard}>
              <Ionicons name="navigate" size={20} color="#210059" />
              <View style={styles.coordinatesDetail}>
                <Text style={styles.coordsLabel}>Latitude</Text>
                <Text style={styles.coordsValue}>{tempLatitude.toFixed(6)}</Text>
              </View>
              <View style={styles.coordinatesDetail}>
                <Text style={styles.coordsLabel}>Longitude</Text>
                <Text style={styles.coordsValue}>{tempLongitude.toFixed(6)}</Text>
              </View>
            </View>
            
            <Text style={styles.addressPreview} numberOfLines={2}>
              {formAddress || 'Address will appear here'}
            </Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowLocationModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={confirmLocation}
            >
              <Ionicons name="checkmark" size={20} color="#FFF" />
              <Text style={styles.modalConfirmText}>Confirm Location</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#210059',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  editButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  imageSection: {
    position: 'relative',
    backgroundColor: '#FFF',
    marginBottom: 16,
  },
  restaurantImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  changeImageText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 16,
  },
  statusInfo: {
    flex: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusSubtext: {
    fontSize: 12,
    color: '#666',
    marginLeft: 32,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
  },
  toggleButtonActive: {
    backgroundColor: '#F44336',
  },
  toggleButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  infoSection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
  },
  editLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE8E8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  editLocationText: {
    color: '#210059',
    fontSize: 14,
    fontWeight: '600',
  },
  coordinatesDisplay: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalInstructions: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 14,
    color: '#666',
    backgroundColor: '#FFF9E6',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE8A3',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#F0F0F0',
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    zIndex: 1,
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  mapPlaceholderText: {
    marginTop: 16,
    fontSize: 14,
    color: '#999',
  },
  locationInfo: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  coordinatesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 16,
  },
  coordinatesDetail: {
    flex: 1,
  },
  coordsLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  coordsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  addressPreview: {
    marginTop: 12,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  modalConfirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#210059',
    borderRadius: 8,
    gap: 8,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  searchContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    outlineStyle: 'none',
  },
  searchResultsDropdown: {
    marginTop: 8,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 250,
    overflow: 'scroll',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 10,
  },
  searchResultTextContainer: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  searchResultAddress: {
    fontSize: 12,
    color: '#666',
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  searchingText: {
    fontSize: 13,
    color: '#999',
  },
});
