import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetchRestaurants();
  }, []);

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
    router.push('/(customer)/orders');
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.locationContainer}
            onPress={handleLocationPress}
            activeOpacity={0.7}
          >
            <Ionicons name="location" size={20} color="#FF6B6B" />
            <Text style={styles.locationText}>{selectedLocation}</Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={handleNotificationPress}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color="#333" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search delivery..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={handleFilterPress}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>

        {/* Hero Banner */}
        <View style={styles.bannerContainer}>
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={handleBannerPress}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF8E53']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBanner}
            >
              <View style={styles.bannerContent}>
                <View style={styles.bannerBadge}>
                  <Text style={styles.bannerBadgeText}>🎉 Special</Text>
                </View>
                <Text style={styles.bannerTitle}>Get 50% Off{'\n'}Your First Order!</Text>
                <View style={styles.bannerButton}>
                  <Text style={styles.bannerButtonText}>Order Now</Text>
                </View>
              </View>
              <View style={styles.bannerImageContainer}>
                <Text style={styles.bannerEmoji}>🍟</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  heroBanner: {
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 160,
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
});
