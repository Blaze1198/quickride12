import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../utils/api';
import { useCartStore } from '../../store/cartStore';
import { Ionicons } from '@expo/vector-icons';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_base64?: string;
  category: string;
  available: boolean;
}

interface Restaurant {
  id: string;
  name: string;
  description: string;
  image_base64?: string;
  location: {
    address: string;
  };
  phone: string;
  menu: MenuItem[];
  operating_hours: string;
  rating: number;
  is_open: boolean;
}

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const { addItem, getItemCount } = useCartStore();

  useEffect(() => {
    if (id) {
      fetchRestaurant();
    }
  }, [id]);

  const fetchRestaurant = async () => {
    try {
      const response = await api.get(`/restaurants/${id}`);
      setRestaurant(response.data);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to load restaurant details');
      } else {
        Alert.alert('Error', 'Failed to load restaurant details');
      }
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (menuItem: MenuItem) => {
    if (!restaurant) return;

    if (!menuItem.available) {
      if (Platform.OS === 'web') {
        window.alert('This item is currently unavailable');
      } else {
        Alert.alert('Unavailable', 'This item is currently unavailable');
      }
      return;
    }

    addItem(
      {
        menu_item_id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
      },
      restaurant.id,
      restaurant.name
    );

    if (Platform.OS === 'web') {
      window.alert(`${menuItem.name} added to cart!`);
    } else {
      Alert.alert('Added to Cart', `${menuItem.name} added to cart!`);
    }
  };

  const groupMenuByCategory = (menu: MenuItem[]) => {
    const grouped: Record<string, MenuItem[]> = {};
    menu.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });
    return grouped;
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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Restaurant not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const groupedMenu = groupMenuByCategory(restaurant.menu);
  const cartItemCount = getItemCount();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/(customer)/cart' as any)}
        >
          <Ionicons name="cart" size={24} color="#333" />
          {cartItemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView>
        {/* Restaurant Image */}
        {restaurant.image_base64 ? (
          <Image
            source={{ uri: restaurant.image_base64 }}
            style={styles.restaurantImage}
          />
        ) : (
          <View style={[styles.restaurantImage, styles.placeholderImage]}>
            <Ionicons name="restaurant" size={64} color="#CCC" />
          </View>
        )}

        {/* Restaurant Info */}
        <View style={styles.infoContainer}>
          <View style={styles.infoHeader}>
            <View style={styles.nameContainer}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              {!restaurant.is_open && (
                <View style={styles.closedBadge}>
                  <Text style={styles.closedBadgeText}>Closed</Text>
                </View>
              )}
            </View>
            <View style={styles.rating}>
              <Ionicons name="star" size={20} color="#FFB800" />
              <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
            </View>
          </View>

          <Text style={styles.description}>{restaurant.description}</Text>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={18} color="#666" />
              <Text style={styles.detailText}>{restaurant.operating_hours}</Text>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={18} color="#666" />
              <Text style={styles.detailText} numberOfLines={2}>
                {restaurant.location.address}
              </Text>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="call-outline" size={18} color="#666" />
              <Text style={styles.detailText}>{restaurant.phone}</Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>Menu</Text>

          {restaurant.menu.length === 0 ? (
            <View style={styles.emptyMenu}>
              <Ionicons name="fast-food-outline" size={48} color="#CCC" />
              <Text style={styles.emptyMenuText}>No menu items available</Text>
            </View>
          ) : (
            Object.entries(groupedMenu).map(([category, items]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {items.map((item) => (
                  <View key={item.id} style={styles.menuItem}>
                    <View style={styles.menuItemInfo}>
                      <Text style={styles.menuItemName}>{item.name}</Text>
                      {item.description && (
                        <Text style={styles.menuItemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                      <Text style={styles.menuItemPrice}>
                        ₱{item.price.toFixed(2)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.addButton,
                        !item.available && styles.addButtonDisabled,
                      ]}
                      onPress={() => handleAddToCart(item)}
                      disabled={!item.available}
                    >
                      <Ionicons
                        name="add"
                        size={24}
                        color={item.available ? '#FFF' : '#999'}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* View Cart Button */}
      {cartItemCount > 0 && (
        <View style={styles.cartFooter}>
          <TouchableOpacity
            style={styles.viewCartButton}
            onPress={() => router.push('/(customer)/cart' as any)}
          >
            <View style={styles.cartInfo}>
              <Text style={styles.cartCount}>{cartItemCount} items</Text>
              <Text style={styles.viewCartText}>View Cart</Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backButton: {
    padding: 12,
    backgroundColor: '#210059',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#210059',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  restaurantImage: {
    width: '100%',
    height: 200,
  },
  placeholderImage: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closedBadge: {
    backgroundColor: '#210059',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  closedBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  detailsRow: {
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  menuContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 80,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyMenu: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyMenuText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#210059',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemInfo: {
    flex: 1,
    marginRight: 16,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#210059',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#210059',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  cartFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  viewCartButton: {
    flexDirection: 'row',
    backgroundColor: '#210059',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartInfo: {
    flex: 1,
  },
  cartCount: {
    color: '#FFF',
    fontSize: 14,
    opacity: 0.9,
  },
  viewCartText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
