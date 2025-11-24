import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Alert,
  Platform,
  Animated,
  PanResponder,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Restaurant {
  id: string;
  name: string;
  description: string;
  image_base64?: string;
  rating: number;
  location: {
    address: string;
  };
  is_open: boolean;
  operating_hours?: string;
}

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: '1', name: 'Burger', icon: '🍔', color: '#210059' },
  { id: '2', name: 'Pizza', icon: '🍕', color: '#000000' },
  { id: '3', name: 'Salad', icon: '🥗', color: '#4CAF50' },
  { id: '4', name: 'Sushi', icon: '🍣', color: '#000000' },
  { id: '5', name: 'Noodles', icon: '🍜', color: '#FF9800' },
  { id: '6', name: 'Dessert', icon: '🍰', color: '#E91E63' },
  { id: '7', name: 'Drinks', icon: '🥤', color: '#2196F3' },
  { id: '8', name: 'More', icon: '➕', color: '#9E9E9E' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('Metro Manila, Philippines');
  const [filters, setFilters] = useState({
    priceRange: 'all',
    rating: 'all',
    deliveryFee: 'all',
    distance: 'all',
  });
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Quick location dropdown
  const [showQuickLocations, setShowQuickLocations] = useState(false);
  const [savedLocations, setSavedLocations] = useState({
    home: { address: '', coordinates: { lat: 0, lng: 0 } },
    work: { address: '', coordinates: { lat: 0, lng: 0 } },
    school: { address: '', coordinates: { lat: 0, lng: 0 } },
  });
  const [editingLocation, setEditingLocation] = useState<'home' | 'work' | 'school' | null>(null);
  
  // Service type selector
  const [serviceType, setServiceType] = useState<'delivery' | 'pickup'>('delivery');
  const [showServicePicker, setShowServicePicker] = useState(false);
  
  // Map picker states
  const [mapLoaded, setMapLoaded] = useState(false);
  const [tempLocation, setTempLocation] = useState({ lat: 14.5547, lng: 121.0244 });
  const [userAddress, setUserAddress] = useState('');
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchTimeoutRef = useRef<any>(null);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [bannerWidth, setBannerWidth] = useState(width - 40); // width minus padding

  const banners = [
    {
      id: 1,
      badge: '🎉 Special',
      title: 'Get 50% Off\nYour First Order!',
      buttonText: 'Order Now',
      emoji: '🍟',
      colors: ['#210059', '#5B21B6'],
    },
    {
      id: 2,
      badge: '🚴 Free Delivery',
      title: 'Free Delivery\nOn Orders ₱500+',
      buttonText: 'Start Ordering',
      emoji: '🚲',
      colors: ['#4CAF50', '#66BB6A'],
    },
    {
      id: 3,
      badge: '💰 Cashback',
      title: '20% Cashback\nWith GCash',
      buttonText: 'Pay with GCash',
      emoji: '💳',
      colors: ['#2196F3', '#42A5F5'],
    },
    {
      id: 4,
      badge: '🎊 Weekend Deal',
      title: '30% Off\nSat & Sunday',
      buttonText: 'View Menu',
      emoji: '🎈',
      colors: ['#9C27B0', '#BA68C8'],
    },
  ];

  useEffect(() => {
    fetchRestaurants();
    loadSavedLocation();
  }, []);

  // Load saved location from backend and localStorage on mount
  const loadSavedLocation = async () => {
    try {
      // Try to load from backend first
      const response = await api.get('/users/me/delivery-location');
      if (response.data) {
        setSelectedLocation(response.data.address);
        setTempLocation({
          lat: response.data.latitude,
          lng: response.data.longitude
        });
        console.log('✅ Loaded saved location from backend:', response.data.address);
        return;
      }
    } catch (error) {
      console.log('No saved location in backend, checking localStorage...');
    }
    
    // Fallback to localStorage if backend has no saved location
    try {
      if (Platform.OS === 'web') {
        const savedLocationData = localStorage.getItem('deliveryLocation');
        if (savedLocationData) {
          const locationData = JSON.parse(savedLocationData);
          setSelectedLocation(locationData.address);
          setTempLocation({
            lat: locationData.latitude,
            lng: locationData.longitude
          });
          console.log('✅ Loaded saved location from localStorage:', locationData.address);
        }
      }
    } catch (error) {
      console.error('Error loading saved location:', error);
    }
  };

  // Auto-slide banner every 4 seconds with animation
  useEffect(() => {
    const interval = setInterval(() => {
      goToNextSlide();
    }, 4000);
    return () => clearInterval(interval);
  }, [currentBannerIndex]);

  // Load map when modal opens
  useEffect(() => {
    if (showLocationPicker && Platform.OS === 'web') {
      console.log('🗺️ Modal opened, loading map...');
      loadMapPicker();
    }
  }, [showLocationPicker]);

  const goToNextSlide = () => {
    const nextIndex = (currentBannerIndex + 1) % banners.length;
    animateSlide(nextIndex);
  };

  const animateSlide = (toIndex: number) => {
    Animated.timing(slideAnim, {
      toValue: -toIndex * bannerWidth,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setCurrentBannerIndex(toIndex);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        slideAnim.setValue(-currentBannerIndex * bannerWidth + gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        const threshold = bannerWidth * 0.3;
        if (gesture.dx > threshold && currentBannerIndex > 0) {
          // Swipe right - go to previous
          animateSlide(currentBannerIndex - 1);
        } else if (gesture.dx < -threshold && currentBannerIndex < banners.length - 1) {
          // Swipe left - go to next
          animateSlide(currentBannerIndex + 1);
        } else {
          // Snap back
          Animated.spring(slideAnim, {
            toValue: -currentBannerIndex * bannerWidth,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const fetchRestaurants = async () => {
    try {
      const response = await api.get('/restaurants');
      setRestaurants(response.data);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchFocus = () => {
    setIsSearchActive(true);
  };

  const handleSearchClose = () => {
    setIsSearchActive(false);
    setSearchQuery('');
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.length > 0) {
      setIsSearchActive(true);
    }
  };

  const toggleFavorite = (restaurantId: string) => {
    console.log('❤️ Toggling favorite for restaurant:', restaurantId);
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(restaurantId)) {
        newFavorites.delete(restaurantId);
        console.log('💔 Removed from favorites');
      } else {
        newFavorites.add(restaurantId);
        console.log('❤️ Added to favorites');
      }
      return newFavorites;
    });
  };

  const handleCategorySelect = (categoryId: string) => {
    console.log('📂 Category selected:', categoryId);
    setSelectedCategory(categoryId);
    
    // Show feedback that category filtering is active
    const category = CATEGORIES.find(c => c.id === categoryId);
    if (category && categoryId !== 'all') {
      // In future, this will filter restaurants by actual category
      console.log(`Filtering by ${category.name} category`);
    }
  };

  const handleLocationPress = () => {
    console.log('📍 Location button pressed - Opening quick locations');
    setShowQuickLocations(!showQuickLocations);
  };

  // Handle quick location selection
  const handleQuickLocation = async (type: 'current' | 'home' | 'work' | 'school' | 'custom') => {
    if (type === 'current') {
      // Get current GPS location and show on map for verification
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        console.log('🔍 Getting current location...');
        setShowQuickLocations(false);
        setMapLoaded(false);
        setShowLocationPicker(true); // Open map modal
        
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setTempLocation(newLocation);
            console.log('✅ Current GPS location:', newLocation);
            
            // Get address from coordinates
            if ((window as any).google) {
              await getAddressFromCoordinates(newLocation.lat, newLocation.lng);
            }
            
            Alert.alert(
              'GPS Location Found',
              'Your current location is shown on the map. You can adjust the marker if needed, then click Confirm.'
            );
          },
          (error) => {
            console.error('❌ Error getting location:', error);
            setShowLocationPicker(false);
            Alert.alert('Location Error', 'Unable to get your current location. Please check permissions or select manually on the map.');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        Alert.alert('GPS Not Available', 'Your device does not support GPS location. Please select location manually.');
      }
    } else if (type === 'custom') {
      // Open map picker for custom location
      setShowQuickLocations(false);
      setMapLoaded(false);
      setShowLocationPicker(true);
      
      // Get user's current location for map center
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setTempLocation(newLocation);
          },
          (error) => console.error('Error getting location:', error),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    } else {
      // Use saved location (home, work, school)
      const saved = savedLocations[type];
      if (saved.address) {
        setSelectedLocation(saved.address);
        setTempLocation(saved.coordinates);
        setShowQuickLocations(false);
        console.log(`✅ ${type} location selected:`, saved);
      } else {
        // No saved location - open map to set it
        setEditingLocation(type);
        setShowQuickLocations(false);
        setMapLoaded(false);
        setShowLocationPicker(true);
        
        // Get current location for map center
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setTempLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude
              });
            },
            (error) => console.error('Error:', error),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      }
    }
  };

  // Load Google Maps and initialize map
  const loadMapPicker = () => {
    console.log('🗺️ loadMapPicker called');
    if (typeof window === 'undefined') {
      console.log('❌ Window is undefined');
      return;
    }

    console.log('✅ Window is defined');
    const apiKey = 'AIzaSyA0m1oRlXLQWjxacqjEJ6zJW3WvmOWvQkQ';

    if ((window as any).google && (window as any).google.maps) {
      console.log('✅ Google Maps already loaded, initializing...');
      setTimeout(() => initializeMapPicker(), 100);
      return;
    }

    console.log('🔄 Google Maps not loaded, checking for existing script...');
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('✅ Script tag exists, waiting for Google Maps to load...');
      const checkInterval = setInterval(() => {
        if ((window as any).google && (window as any).google.maps) {
          clearInterval(checkInterval);
          console.log('✅ Google Maps loaded from existing script');
          initializeMapPicker();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!mapLoaded) {
          console.error('⏱️ Timeout waiting for Google Maps');
        }
      }, 10000);
      return;
    }

    console.log('📝 Creating new Google Maps script tag...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('✅ Script loaded, waiting for google.maps...');
      setTimeout(() => {
        if ((window as any).google && (window as any).google.maps) {
          console.log('✅ Google Maps API ready!');
          initializeMapPicker();
        } else {
          console.error('❌ Google Maps API not available after script load');
        }
      }, 100);
    };
    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps script:', error);
    };
    document.head.appendChild(script);
    console.log('✅ Script tag appended to document');
  };

  // Initialize interactive map
  const initializeMapPicker = () => {
    console.log('🗺️ initializeMapPicker called');
    const google = (window as any).google;
    if (!google) {
      console.error('❌ Google object not available');
      return;
    }
    if (!mapRef.current) {
      console.error('❌ Map ref not available');
      return;
    }

    console.log('✅ Creating map with center:', tempLocation);

    const map = new google.maps.Map(mapRef.current, {
      center: tempLocation,
      zoom: 16,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    console.log('✅ Map created, adding marker...');

    // Add draggable marker with enhanced visibility
    const marker = new google.maps.Marker({
      position: tempLocation,
      map,
      draggable: true,
      animation: google.maps.Animation.DROP, // Drop animation on load
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 18, // Larger size
        fillColor: '#210059',
        fillOpacity: 1,
        strokeColor: '#FFF',
        strokeWeight: 4,
      },
      title: 'Drag me to your exact location',
    });

    console.log('✅ Marker added');
    markerRef.current = marker;

    // Add pulsing circle around marker for better visibility
    const pulsingCircle = new google.maps.Circle({
      map: map,
      center: tempLocation,
      radius: 30, // 30 meters radius
      fillColor: '#210059',
      fillOpacity: 0.2,
      strokeColor: '#210059',
      strokeOpacity: 0.6,
      strokeWeight: 2,
    });

    // Animate pulsing effect
    let growing = true;
    let radius = 30;
    const pulseInterval = setInterval(() => {
      if (growing) {
        radius += 2;
        if (radius >= 60) growing = false;
      } else {
        radius -= 2;
        if (radius <= 30) growing = true;
      }
      pulsingCircle.setRadius(radius);
    }, 100);

    // Update circle position when marker is dragged
    marker.addListener('drag', () => {
      const position = marker.getPosition();
      if (position) {
        pulsingCircle.setCenter({ lat: position.lat(), lng: position.lng() });
      }
    });

    // Update location when marker is dragged
    marker.addListener('dragend', () => {
      const position = marker.getPosition();
      const newLocation = {
        lat: position.lat(),
        lng: position.lng()
      };
      console.log('📍 Marker dragged to:', newLocation);
      setTempLocation(newLocation);
      getAddressFromCoordinates(newLocation.lat, newLocation.lng);
    });

    // Update location when map is clicked
    map.addListener('click', (event: any) => {
      const newLocation = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      console.log('📍 Map clicked at:', newLocation);
      marker.setPosition(newLocation);
      setTempLocation(newLocation);
      getAddressFromCoordinates(newLocation.lat, newLocation.lng);
    });

    // Get initial address
    getAddressFromCoordinates(tempLocation.lat, tempLocation.lng);
    
    setMapLoaded(true);
    console.log('✅ Map initialization complete!');
  };

  // Reverse geocoding to get address from coordinates
  const getAddressFromCoordinates = async (lat: number, lng: number) => {
    const google = (window as any).google;
    if (!google) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
      if (status === 'OK' && results[0]) {
        const address = results[0].formatted_address;
        setUserAddress(address);
        setSelectedLocation(address);
        console.log('📍 Address:', address);
      }
    });
  };

  // Search location using Google Places Autocomplete (Simplified approach)
  const handleSearchLocation = async (query: string) => {
    setLocationSearchQuery(query);
    console.log('🔍 Search query:', query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      console.log('⚠️ Query too short, need at least 3 characters');
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      const google = (window as any).google;
      if (!google || !google.maps || !google.maps.places) {
        console.error('❌ Google Maps Places API not available');
        return;
      }

      console.log('✅ Google Maps Places API available, using PlacesService...');

      try {
        // Create a dummy div for PlacesService
        const dummyDiv = document.createElement('div');
        const service = new google.maps.places.PlacesService(dummyDiv);
        
        // Use textSearch instead of autocomplete
        const request = {
          query: query,
          fields: ['place_id', 'name', 'formatted_address', 'geometry'],
        };

        service.textSearch(request, (results: any, status: any) => {
          console.log('📍 Search status:', status);
          console.log('📍 Results:', results);
          
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            // Format results to match our UI
            const formattedResults = results.map((place: any) => ({
              place_id: place.place_id,
              structured_formatting: {
                main_text: place.name,
                secondary_text: place.formatted_address,
              },
              description: `${place.name}, ${place.formatted_address}`,
            }));
            
            setSearchResults(formattedResults);
            setShowSearchResults(true);
            console.log('✅ Found', formattedResults.length, 'results');
          } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            console.log('⚠️ No results found for:', query);
            setSearchResults([]);
            setShowSearchResults(false);
          } else {
            console.error('❌ Search failed with status:', status);
            setSearchResults([]);
            setShowSearchResults(false);
          }
        });
      } catch (error) {
        console.error('❌ Error in search:', error);
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);
  };

  // Select location from search results
  const selectSearchResult = (placeId: string) => {
    const google = (window as any).google;
    if (!google) return;

    console.log('📍 Selecting place with ID:', placeId);

    const service = new google.maps.places.PlacesService(document.createElement('div'));
    service.getDetails({ placeId, fields: ['geometry', 'formatted_address', 'name'] }, (place: any, status: any) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place.geometry) {
        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        
        console.log('✅ Place found:', place.name, location);
        
        setTempLocation(location);
        setUserAddress(place.formatted_address || place.name);
        setLocationSearchQuery('');
        setSearchResults([]);
        setShowSearchResults(false);
        
        // Move marker on map if it exists
        if (markerRef.current && mapRef.current) {
          markerRef.current.setPosition(location);
          
          // Animate marker with bounce
          markerRef.current.setAnimation(google.maps.Animation.BOUNCE);
          setTimeout(() => {
            if (markerRef.current) {
              markerRef.current.setAnimation(null);
            }
          }, 2100); // Bounce for ~2 seconds
          
          // Center and zoom map on selected location
          const currentMap = markerRef.current.getMap();
          if (currentMap) {
            currentMap.setCenter(location);
            currentMap.setZoom(17); // Closer zoom for better view
          }
          
          console.log('✅ Map centered and marker positioned at:', location);
        } else {
          console.warn('⚠️ Marker or map ref not available yet');
        }
      } else {
        console.error('❌ Failed to get place details:', status);
      }
    });
  };

  // Confirm selected location
  const confirmLocation = async () => {
    const address = userAddress || selectedLocation;
    
    // If editing a saved location (home, work, school), save it
    if (editingLocation) {
      setSavedLocations({
        ...savedLocations,
        [editingLocation]: {
          address: address,
          coordinates: tempLocation
        }
      });
      console.log(`✅ ${editingLocation} location saved:`, { address, coordinates: tempLocation });
      setEditingLocation(null);
    }
    
    setSelectedLocation(address);
    setShowLocationPicker(false);
    
    // Save to backend first
    try {
      await api.put('/users/me/delivery-location', {
        address: address,
        latitude: tempLocation.lat,
        longitude: tempLocation.lng
      });
      console.log('✅ Location saved to backend:', { address, coordinates: tempLocation });
    } catch (error) {
      console.error('Error saving to backend:', error);
    }
    
    // Also save to localStorage for checkout page to access
    try {
      localStorage.setItem('deliveryLocation', JSON.stringify({
        address: address,
        latitude: tempLocation.lat,
        longitude: tempLocation.lng,
        timestamp: new Date().toISOString()
      }));
      console.log('✅ Location also saved to localStorage for checkout');
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  const handleNotificationPress = () => {
    console.log('🔔 Notification button pressed');
    setShowNotifications(!showNotifications);
  };

  const handleFilterPress = () => {
    console.log('🎚️ Filter button pressed');
    setShowFilters(!showFilters);
  };

  const handleBannerPress = () => {
    console.log('🎉 Banner pressed - Navigating to deals page');
    router.push('/deals');
  };

  const handleSeeAllPress = () => {
    console.log('👀 See all pressed - Resetting filters');
    setSelectedCategory('all');
    setSearchQuery('');
  };

  const filteredRestaurants = restaurants.filter((r) => {
    // Search filter
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Category filter (in a real app, restaurants would have a category field)
    // For now, we show all restaurants when any category is selected
    const matchesCategory = selectedCategory === 'all' || true;
    
    return matchesSearch && matchesCategory;
  });

  const renderCategory = (category: typeof CATEGORIES[0]) => {
    const isSelected = selectedCategory === category.id;
    return (
      <TouchableOpacity
        key={category.id}
        style={styles.categoryItem}
        onPress={() => handleCategorySelect(category.id)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.categoryIcon, 
          { backgroundColor: category.color },
          isSelected && styles.categoryIconSelected
        ]}>
          <Text style={styles.categoryEmoji}>{category.icon}</Text>
        </View>
        <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
          {category.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderRestaurantCard = (item: Restaurant) => {
    const isFavorite = favorites.has(item.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.restaurantCard}
        onPress={() => router.push(`/restaurant/${item.id}` as any)}
        activeOpacity={0.9}
      >
        <View style={styles.cardImageContainer}>
          {item.image_base64 ? (
            <Image
              source={{ uri: item.image_base64 }}
              style={styles.cardImage}
            />
          ) : (
            <View style={[styles.cardImage, styles.placeholderImage]}>
              <Ionicons name="restaurant" size={48} color="#CCC" />
            </View>
          )}
          {!item.is_open && (
            <View style={styles.closedOverlay}>
              <Text style={styles.closedText}>Closed</Text>
            </View>
          )}
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={20} 
              color={isFavorite ? "#210059" : "#FFF"} 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {item.description || 'Delicious food'}
          </Text>

          <View style={styles.cardFooter}>
            <View style={styles.cardRating}>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>(120+)</Text>
            </View>
          </View>

          <View style={styles.cardDeliveryInfo}>
            <View style={styles.deliveryItem}>
              <Ionicons name="bicycle" size={14} color="#210059" />
              <Text style={styles.deliveryText}>₱0 Delivery fee</Text>
            </View>
            <View style={styles.deliveryItem}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={styles.deliveryText}>20-30 min</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header - Always Visible */}
        <View style={styles.header}>
          <View style={styles.deliverToContainer}>
            <Ionicons name="location-sharp" size={18} color="#000" />
            <View style={styles.deliverToTextContainer}>
              <Text style={styles.deliverToLabel}>Deliver to</Text>
              <Text style={styles.deliverToValue}>HOME</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => router.push('/(customer)/profile')}
            activeOpacity={0.7}
          >
            <View style={styles.profileCircle}>
              <Ionicons name="person" size={20} color="#210059" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar - Always Visible */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="What are you craving?"
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={handleSearchFocus}
              placeholderTextColor="#999"
            />
            {isSearchActive && (
              <TouchableOpacity onPress={handleSearchClose}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Main Content - Hidden when searching */}
        {!isSearchActive && (
          <View>
            {/* Hero Banner Carousel */}
            <View style={styles.newBannerContainer}>
              <View style={styles.bannerCarouselContainer} {...panResponder.panHandlers}>
                <Animated.View
                  style={[
                    styles.bannerTrack,
                    {
                      transform: [{ translateX: slideAnim }],
                      width: bannerWidth * banners.length,
                    },
                  ]}
                >
                  {banners.map((banner, index) => (
                    <TouchableOpacity
                      key={banner.id}
                      activeOpacity={0.9}
                      onPress={handleBannerPress}
                      style={{ width: bannerWidth }}
                    >
                      <LinearGradient
                        colors={banner.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroBanner}
                      >
                        <View style={styles.bannerContent}>
                          <View style={styles.bannerBadge}>
                            <Text style={styles.bannerBadgeText}>{banner.badge}</Text>
                          </View>
                          <Text style={styles.bannerTitle}>{banner.title}</Text>
                          <View style={styles.bannerButton}>
                            <Text style={styles.bannerButtonText}>{banner.buttonText}</Text>
                          </View>
                        </View>
                        <View style={styles.bannerImageContainer}>
                          <Text style={styles.bannerEmoji}>{banner.emoji}</Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              </View>

              {/* Pagination Dots */}
              <View style={styles.paginationContainer}>
                {banners.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => animateSlide(index)}
                    style={[
                      styles.paginationDot,
                      index === currentBannerIndex && styles.paginationDotActive
                    ]}
                  />
                ))}
              </View>
            </View>

        {/* Categories */}
        <View style={styles.categoriesSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {CATEGORIES.map(renderCategory)}
          </ScrollView>
        </View>

        {/* Top Picks Section */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Top picks on delivery™</Text>
            {selectedCategory !== 'all' && (
              <Text style={styles.activeFilter}>
                Showing: {CATEGORIES.find(c => c.id === selectedCategory)?.name} {CATEGORIES.find(c => c.id === selectedCategory)?.icon}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={handleSeeAllPress} activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        {/* Restaurant Grid */}
        <View style={styles.restaurantsGrid}>
          {filteredRestaurants.length > 0 ? (
            filteredRestaurants.map(renderRestaurantCard)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>No restaurants found</Text>
            </View>
          )}
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 100 }} />
          </View>
        )}

        {/* Full-Screen Search Results Overlay */}
        {isSearchActive && (
          <View style={styles.searchOverlay}>
            <View style={styles.searchResultsContainer}>
              <Text style={styles.searchResultsTitle}>
                {searchQuery ? `Results for "${searchQuery}"` : 'Start typing to search...'}
              </Text>
              <Text style={styles.searchResultsCount}>
                {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''} found
              </Text>

              {filteredRestaurants.length > 0 ? (
                <View style={styles.searchResults}>
                  {filteredRestaurants.map(renderRestaurantCard)}
                </View>
              ) : searchQuery.length > 0 ? (
                <View style={styles.noResults}>
                  <Ionicons name="search-outline" size={64} color="#CCC" />
                  <Text style={styles.noResultsText}>No restaurants found</Text>
                  <Text style={styles.noResultsSubtext}>Try searching for something else</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Location Picker Modal */}
      {/* Quick Locations Dropdown */}
      {showQuickLocations && (
        <TouchableOpacity 
          style={styles.quickLocationsOverlay}
          activeOpacity={1}
          onPress={() => setShowQuickLocations(false)}
        >
          <View style={styles.quickLocationsDropdown}>
            {/* Current Location */}
            <TouchableOpacity
              style={styles.quickLocationItem}
              onPress={() => handleQuickLocation('current')}
            >
              <View style={styles.quickLocationIcon}>
                <Ionicons name="navigate-circle" size={24} color="#2196F3" />
              </View>
              <View style={styles.quickLocationTextContainer}>
                <Text style={styles.quickLocationTitle}>Current Location</Text>
                <Text style={styles.quickLocationSubtitle}>Use GPS to get your location</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {/* Home */}
            <TouchableOpacity
              style={styles.quickLocationItem}
              onPress={() => handleQuickLocation('home')}
            >
              <View style={styles.quickLocationIcon}>
                <Ionicons name="home" size={24} color="#210059" />
              </View>
              <View style={styles.quickLocationTextContainer}>
                <Text style={styles.quickLocationTitle}>🏠 Home</Text>
                <Text style={styles.quickLocationSubtitle}>
                  {savedLocations.home.address || 'Tap to set home address'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {/* Work */}
            <TouchableOpacity
              style={styles.quickLocationItem}
              onPress={() => handleQuickLocation('work')}
            >
              <View style={styles.quickLocationIcon}>
                <Ionicons name="briefcase" size={24} color="#4CAF50" />
              </View>
              <View style={styles.quickLocationTextContainer}>
                <Text style={styles.quickLocationTitle}>💼 Work</Text>
                <Text style={styles.quickLocationSubtitle}>
                  {savedLocations.work.address || 'Tap to set work address'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {/* School */}
            <TouchableOpacity
              style={styles.quickLocationItem}
              onPress={() => handleQuickLocation('school')}
            >
              <View style={styles.quickLocationIcon}>
                <Ionicons name="school" size={24} color="#FF9800" />
              </View>
              <View style={styles.quickLocationTextContainer}>
                <Text style={styles.quickLocationTitle}>🎓 School</Text>
                <Text style={styles.quickLocationSubtitle}>
                  {savedLocations.school.address || 'Tap to set school address'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <View style={styles.quickLocationDivider} />

            {/* Set on Map */}
            <TouchableOpacity
              style={styles.quickLocationItem}
              onPress={() => handleQuickLocation('custom')}
            >
              <View style={styles.quickLocationIcon}>
                <Ionicons name="map" size={24} color="#9C27B0" />
              </View>
              <View style={styles.quickLocationTextContainer}>
                <Text style={styles.quickLocationTitle}>📍 Select on Map</Text>
                <Text style={styles.quickLocationSubtitle}>Choose exact location</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Google Maps Location Picker Modal */}
      {showLocationPicker && (
        <Modal
          visible={showLocationPicker}
          animationType="slide"
          onRequestClose={() => setShowLocationPicker(false)}
        >
          <SafeAreaView style={styles.mapModalContainer}>
            {/* Map Header */}
            <View style={styles.mapHeader}>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
              <Text style={styles.mapHeaderTitle}>📍 Select Your Location</Text>
              <View style={{ width: 28 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchBarContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#666" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search for a place (e.g., SM Mall, Makati)..."
                  value={locationSearchQuery}
                  onChangeText={handleSearchLocation}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {locationSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => {
                    setLocationSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <ScrollView style={styles.searchResultsContainer}>
                  {searchResults.map((result: any) => (
                    <TouchableOpacity
                      key={result.place_id}
                      style={styles.searchResultItem}
                      onPress={() => selectSearchResult(result.place_id)}
                    >
                      <Ionicons name="location-outline" size={20} color="#210059" />
                      <View style={styles.searchResultTextContainer}>
                        <Text style={styles.searchResultMain}>
                          {result.structured_formatting.main_text}
                        </Text>
                        <Text style={styles.searchResultSecondary}>
                          {result.structured_formatting.secondary_text}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              
              {/* Tip Text */}
              <Text style={styles.tipText}>
                💡 Tip: You can also drag the marker or click on the map
              </Text>
            </View>

            {/* Map Container */}
            {Platform.OS === 'web' ? (
              <View style={styles.mapPickerContainer}>
                {!mapLoaded && (
                  <View style={styles.mapLoading}>
                    <ActivityIndicator size="large" color="#210059" />
                    <Text style={styles.mapLoadingText}>Loading map...</Text>
                    <Text style={styles.mapLoadingSubtext}>Please allow location access</Text>
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
            ) : null}

            {/* Address Display */}
            <View style={styles.mapAddressContainer}>
              <View style={styles.mapAddressCard}>
                <Ionicons name="location" size={24} color="#210059" />
                <View style={styles.mapAddressTextContainer}>
                  <Text style={styles.mapAddressLabel}>Selected Location</Text>
                  <Text style={styles.mapAddressText} numberOfLines={2}>
                    {userAddress || selectedLocation || 'Drag the marker to select location'}
                  </Text>
                  <Text style={styles.mapCoordinates}>
                    📍 {tempLocation.lat.toFixed(6)}, {tempLocation.lng.toFixed(6)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Confirm Button */}
            <View style={styles.mapFooter}>
              <TouchableOpacity
                style={styles.confirmLocationButton}
                onPress={confirmLocation}
              >
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <Text style={styles.confirmLocationText}>Confirm Location</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* Filters Modal */}
      {showFilters && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🎚️ Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              {/* Delivery Fee Filter */}
              <Text style={styles.filterLabel}>Delivery Fee</Text>
              {['all', 'free', 'under50', 'under100'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.filterOption, filters.deliveryFee === option && styles.filterOptionSelected]}
                  onPress={() => setFilters({ ...filters, deliveryFee: option })}
                >
                  <Text style={[styles.filterOptionText, filters.deliveryFee === option && styles.filterOptionTextSelected]}>
                    {option === 'all' ? 'All' : option === 'free' ? 'Free Delivery' : option === 'under50' ? 'Under ₱50' : 'Under ₱100'}
                  </Text>
                  {filters.deliveryFee === option && <Ionicons name="checkmark-circle" size={20} color="#210059" />}
                </TouchableOpacity>
              ))}

              {/* Rating Filter */}
              <Text style={styles.filterLabel}>Minimum Rating</Text>
              {['all', '4', '4.5', '5'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.filterOption, filters.rating === option && styles.filterOptionSelected]}
                  onPress={() => setFilters({ ...filters, rating: option })}
                >
                  <Text style={[styles.filterOptionText, filters.rating === option && styles.filterOptionTextSelected]}>
                    {option === 'all' ? 'All Ratings' : `${option}+ ⭐`}
                  </Text>
                  {filters.rating === option && <Ionicons name="checkmark-circle" size={20} color="#210059" />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Notifications Dropdown */}
      {showNotifications && (
        <View style={styles.notificationDropdownContainer}>
          <View style={styles.notificationDropdown}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>🔔 Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.notificationList}>
              {/* Sample Notifications */}
              <TouchableOpacity 
                style={styles.notificationItem}
                onPress={() => {
                  setShowNotifications(false);
                  router.push('/(customer)/orders');
                }}
              >
                <View style={styles.notificationIcon}>
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationItemTitle}>Order Delivered! 🎉</Text>
                  <Text style={styles.notificationItemText}>Your order #1234 has been delivered</Text>
                  <Text style={styles.notificationTime}>5 min ago</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.notificationItem}
                onPress={() => {
                  setShowNotifications(false);
                  router.push('/(customer)/orders');
                }}
              >
                <View style={styles.notificationIcon}>
                  <Ionicons name="bicycle" size={24} color="#210059" />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationItemTitle}>Out for Delivery 🚴</Text>
                  <Text style={styles.notificationItemText}>Your rider is on the way</Text>
                  <Text style={styles.notificationTime}>15 min ago</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.notificationItem}
                onPress={() => {
                  setShowNotifications(false);
                  router.push('/deals');
                }}
              >
                <View style={styles.notificationIcon}>
                  <Ionicons name="gift" size={24} color="#9C27B0" />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationItemTitle}>Special Offer! 🎁</Text>
                  <Text style={styles.notificationItemText}>Get 50% off on your next order</Text>
                  <Text style={styles.notificationTime}>1 hour ago</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={styles.viewAllNotifications}
              onPress={() => {
                setShowNotifications(false);
                router.push('/(customer)/orders');
              }}
            >
              <Text style={styles.viewAllNotificationsText}>View All Orders</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 2,
    borderBottomColor: '#FFE8E8',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE8E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  locationBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#210059',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceToggleButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#210059',
  },

  // Service Type Selector
  serviceTypeContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  serviceSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0FF',
    gap: 10,
  },
  serviceTypeText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#210059',
  },
  servicePickerDropdown: {
    marginTop: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  serviceOptionActive: {
    backgroundColor: '#F8F8FF',
  },
  serviceOptionText: {
    flex: 1,
  },
  serviceOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  serviceOptionTitleActive: {
    color: '#210059',
  },
  serviceOptionSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  serviceDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },

  // Search Section
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hero Banner
  bannerContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  bannerCarouselContainer: {
    overflow: 'hidden',
  },
  bannerTrack: {
    flexDirection: 'row',
  },
  heroBanner: {
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 160,
    marginRight: 0,
  },
  bannerContent: {
    flex: 1,
  },
  bannerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  bannerBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
    lineHeight: 34,
  },
  bannerButton: {
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerImageContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerEmoji: {
    fontSize: 64,
  },

  // Pagination Dots
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDD',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#210059',
  },

  // Categories
  categoriesSection: {
    marginTop: 24,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIconSelected: {
    borderWidth: 3,
    borderColor: '#210059',
  },
  categoryEmoji: {
    fontSize: 32,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  categoryNameSelected: {
    color: '#210059',
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  activeFilter: {
    fontSize: 12,
    color: '#210059',
    marginTop: 4,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#210059',
  },

  // Restaurant Cards
  restaurantsGrid: {
    paddingHorizontal: 20,
  },
  restaurantCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  cardImageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reviewCount: {
    fontSize: 12,
    color: '#999',
  },
  cardDeliveryInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  deliveryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryText: {
    fontSize: 12,
    color: '#666',
  },

  // Empty State
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

  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  locationItemSelected: {
    backgroundColor: '#FFE8E8',
    borderWidth: 2,
    borderColor: '#210059',
  },
  locationItemText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  locationItemTextSelected: {
    color: '#210059',
    fontWeight: '600',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 8,
  },
  filterOptionSelected: {
    backgroundColor: '#FFE8E8',
    borderWidth: 2,
    borderColor: '#210059',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666',
  },
  filterOptionTextSelected: {
    color: '#210059',
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: '#210059',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  applyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Search Overlay Styles
  searchOverlay: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: 20,
  },
  searchResultsContainer: {
    padding: 20,
  },
  searchResultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  searchResultsCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  searchResults: {
    gap: 0,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },

  // Notification Dropdown Styles
  notificationDropdownContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 1000,
  },
  notificationDropdown: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: 320,
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationList: {
    maxHeight: 300,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  notificationIcon: {
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  notificationItemText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#999',
  },
  viewAllNotifications: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  viewAllNotificationsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#210059',
  },
  // Google Maps Location Picker Styles
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    backgroundColor: '#FFF',
  },
  mapHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  mapPickerContainer: {
    flex: 1,
    position: 'relative',
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    zIndex: 10,
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  mapLoadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  mapAddressContainer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  mapAddressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  mapAddressTextContainer: {
    flex: 1,
  },
  mapAddressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  mapAddressText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  mapCoordinates: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  mapFooter: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  confirmLocationButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmLocationText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Quick Locations Dropdown Styles
  quickLocationsOverlay: {
    position: 'absolute',
    top: 60, // Position right below the location button
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  quickLocationsDropdown: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  quickLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  quickLocationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLocationTextContainer: {
    flex: 1,
  },
  quickLocationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  quickLocationSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  quickLocationDivider: {
    height: 1,
    backgroundColor: '#EEE',
    marginHorizontal: 16,
  },
  // Search Bar Styles
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    outlineStyle: 'none',
  },
  searchResultsContainer: {
    maxHeight: 250,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultTextContainer: {
    flex: 1,
  },
  searchResultMain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  searchResultSecondary: {
    fontSize: 12,
    color: '#666',
  },
  tipText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
