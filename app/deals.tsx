import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../utils/api';
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
}

export default function DealsScreen() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deals & Promotions</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Main Promo Banner */}
        <View style={styles.mainBannerContainer}>
          <LinearGradient
            colors={['#210059', '#5B21B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mainBanner}
          >
            <View style={styles.mainBannerContent}>
              <Text style={styles.mainBannerBadge}>🎉 LIMITED TIME OFFER</Text>
              <Text style={styles.mainBannerTitle}>Get 50% OFF</Text>
              <Text style={styles.mainBannerSubtitle}>On Your First Order!</Text>
              <View style={styles.promoCodeBox}>
                <Text style={styles.promoCodeLabel}>Use Code:</Text>
                <Text style={styles.promoCode}>FIRST50</Text>
              </View>
              <Text style={styles.promoDetails}>• Valid for all restaurants</Text>
              <Text style={styles.promoDetails}>• Minimum order: ₱200</Text>
              <Text style={styles.promoDetails}>• Valid until Dec 31, 2025</Text>
            </View>
            <View style={styles.mainBannerEmoji}>
              <Text style={styles.emojiLarge}>🍟</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Other Deals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Deals</Text>

          {/* Free Delivery Deal */}
          <View style={styles.dealCard}>
            <View style={styles.dealIcon}>
              <Text style={styles.dealEmoji}>🚴</Text>
            </View>
            <View style={styles.dealContent}>
              <Text style={styles.dealTitle}>Free Delivery</Text>
              <Text style={styles.dealDescription}>On orders above ₱500</Text>
              <Text style={styles.dealCode}>Code: FREEDEL</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </View>

          {/* Bundle Deal */}
          <View style={styles.dealCard}>
            <View style={styles.dealIcon}>
              <Text style={styles.dealEmoji}>🍔</Text>
            </View>
            <View style={styles.dealContent}>
              <Text style={styles.dealTitle}>Buy 1 Get 1 Free</Text>
              <Text style={styles.dealDescription}>On selected restaurants</Text>
              <Text style={styles.dealCode}>Code: BOGO</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </View>

          {/* Cashback Deal */}
          <View style={styles.dealCard}>
            <View style={styles.dealIcon}>
              <Text style={styles.dealEmoji}>💰</Text>
            </View>
            <View style={styles.dealContent}>
              <Text style={styles.dealTitle}>20% Cashback</Text>
              <Text style={styles.dealDescription}>For GCash payments</Text>
              <Text style={styles.dealCode}>Code: GCASH20</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </View>

          {/* Weekend Deal */}
          <View style={styles.dealCard}>
            <View style={styles.dealIcon}>
              <Text style={styles.dealEmoji}>🎊</Text>
            </View>
            <View style={styles.dealContent}>
              <Text style={styles.dealTitle}>Weekend Special</Text>
              <Text style={styles.dealDescription}>30% off on Saturdays & Sundays</Text>
              <Text style={styles.dealCode}>Code: WEEKEND30</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#999" />
          </View>
        </View>

        {/* Participating Restaurants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participating Restaurants</Text>
          <Text style={styles.sectionSubtitle}>All {restaurants.length} restaurants accept these deals!</Text>

          <View style={styles.restaurantsGrid}>
            {restaurants.map((restaurant) => (
              <TouchableOpacity
                key={restaurant.id}
                style={styles.restaurantChip}
                onPress={() => router.push(`/restaurant/${restaurant.id}` as any)}
              >
                <Text style={styles.restaurantChipText}>{restaurant.name}</Text>
                <Ionicons name="chevron-forward" size={16} color="#210059" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },

  // Main Banner
  mainBannerContainer: {
    padding: 20,
  },
  mainBanner: {
    borderRadius: 20,
    padding: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 300,
  },
  mainBannerContent: {
    flex: 1,
  },
  mainBannerBadge: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
  },
  mainBannerTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  mainBannerSubtitle: {
    fontSize: 24,
    color: '#FFF',
    marginBottom: 24,
  },
  promoCodeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  promoCodeLabel: {
    color: '#FFF',
    fontSize: 12,
    marginBottom: 4,
  },
  promoCode: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  promoDetails: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 4,
  },
  mainBannerEmoji: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
  },
  emojiLarge: {
    fontSize: 80,
  },

  // Section
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },

  // Deal Cards
  dealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dealIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dealEmoji: {
    fontSize: 32,
  },
  dealContent: {
    flex: 1,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  dealDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dealCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#210059',
  },

  // Restaurants Grid
  restaurantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  restaurantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  restaurantChipText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});
