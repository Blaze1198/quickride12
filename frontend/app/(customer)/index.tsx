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
  { id: '1', name: 'Burger', icon: '🍔', color: '#FF6B6B' },
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
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [bannerWidth, setBannerWidth] = useState(width - 40); // width minus padding

  const banners = [
    {
      id: 1,
      badge: '🎉 Special',
      title: 'Get 50% Off\nYour First Order!',
      buttonText: 'Order Now',
      emoji: '🍟',
      colors: ['#FF6B6B', '#FF8E53'],
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
  }, []);

  // Auto-slide banner every 4 seconds with animation
  useEffect(() => {
    const interval = setInterval(() => {
      goToNextSlide();
    }, 4000);
    return () => clearInterval(interval);
  }, [currentBannerIndex]);

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
    console.log('📍 Location button pressed');
    setShowLocationPicker(!showLocationPicker);
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
              color={isFavorite ? "#FF6B6B" : "#FFF"} 
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
              <Ionicons name="bicycle" size={14} color="#FF6B6B" />
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
          <ActivityIndicator size="large" color="#FF6B6B" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header - Always Visible */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.homeTitle}>Home</Text>
            <TouchableOpacity 
              style={styles.locationBadge}
              onPress={handleLocationPress}
              activeOpacity={0.7}
            >
              <Ionicons name="location" size={14} color="#FF6B6B" />
              <Text style={styles.locationBadgeText}>{selectedLocation.split(',')[0]}</Text>
              <Ionicons name="chevron-down" size={12} color="#666" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={handleNotificationPress}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color="#333" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>

        {/* Search Bar - Always Visible */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search delivery..."
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
          {!isSearchActive && (
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={handleFilterPress}
              activeOpacity={0.7}
            >
              <Ionicons name="options-outline" size={24} color="#FF6B6B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Main Content - Hidden when searching */}
        {!isSearchActive && (
          <View>
            {/* Hero Banner Carousel */}
            <View style={styles.bannerContainer}>
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
      {showLocationPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📍 Select Location</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {['Metro Manila, Philippines', 'Quezon City, Philippines', 'Makati City, Philippines', 'Taguig City, Philippines', 'Pasig City, Philippines'].map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[styles.locationItem, selectedLocation === loc && styles.locationItemSelected]}
                onPress={() => {
                  setSelectedLocation(loc);
                  setShowLocationPicker(false);
                }}
              >
                <Ionicons name="location" size={20} color={selectedLocation === loc ? "#FF6B6B" : "#666"} />
                <Text style={[styles.locationItemText, selectedLocation === loc && styles.locationItemTextSelected]}>{loc}</Text>
                {selectedLocation === loc && <Ionicons name="checkmark-circle" size={20} color="#FF6B6B" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
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
                  {filters.deliveryFee === option && <Ionicons name="checkmark-circle" size={20} color="#FF6B6B" />}
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
                  {filters.rating === option && <Ionicons name="checkmark-circle" size={20} color="#FF6B6B" />}
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
                  <Ionicons name="bicycle" size={24} color="#FF6B6B" />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  homeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#FF6B6B',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    backgroundColor: '#FF6B6B',
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
    backgroundColor: '#FF6B6B',
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
    borderColor: '#FF6B6B',
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
    color: '#FF6B6B',
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
    color: '#FF6B6B',
    marginTop: 4,
    fontWeight: '600',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
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
    borderColor: '#FF6B6B',
  },
  locationItemText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  locationItemTextSelected: {
    color: '#FF6B6B',
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
    borderColor: '#FF6B6B',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666',
  },
  filterOptionTextSelected: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: '#FF6B6B',
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
    color: '#FF6B6B',
  },
});
