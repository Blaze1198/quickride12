import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';

interface Restaurant {
  id: string;
  name: string;
  description?: string;
  image_base64?: string;
  phone: string;
  is_open: boolean;
  owner_id: string;
  location: {
    address: string;
  };
}

export default function AdminRestaurantsScreen() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

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
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRestaurants();
  };

  const handleDeleteRestaurant = async (restaurantId: string, restaurantName: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Are you sure you want to delete "${restaurantName}"? This action cannot be undone.`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Delete Restaurant',
            `Are you sure you want to delete "${restaurantName}"? This action cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    setDeleting(restaurantId);
    try {
      await api.delete(`/admin/restaurants/${restaurantId}`);
      
      if (Platform.OS === 'web') {
        window.alert('Restaurant deleted successfully');
      } else {
        Alert.alert('Success', 'Restaurant deleted successfully');
      }
      
      fetchRestaurants();
    } catch (error: any) {
      console.error('Error deleting restaurant:', error);
      
      const message = error.response?.data?.detail || 'Failed to delete restaurant';
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setDeleting(null);
    }
  };

  const toggleRestaurantStatus = async (restaurantId: string, currentStatus: boolean) => {
    try {
      await api.put(`/admin/restaurants/${restaurantId}/status`, {
        is_open: !currentStatus,
      });
      fetchRestaurants();
    } catch (error) {
      console.error('Error toggling restaurant status:', error);
    }
  };

  const renderRestaurant = ({ item }: { item: Restaurant }) => (
    <View style={styles.restaurantCard}>
      <View style={styles.cardHeader}>
        {item.image_base64 ? (
          <Image source={{ uri: item.image_base64 }} style={styles.restaurantImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="restaurant" size={32} color="#CCC" />
          </View>
        )}
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{item.name}</Text>
          <Text style={styles.restaurantAddress} numberOfLines={1}>
            {item.location.address}
          </Text>
          <Text style={styles.restaurantPhone}>{item.phone}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.is_open ? '#4CAF50' : '#F44336' }]}>
            <Text style={styles.statusText}>{item.is_open ? 'OPEN' : 'CLOSED'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.toggleButton]}
          onPress={() => toggleRestaurantStatus(item.id, item.is_open)}
        >
          <Ionicons
            name={item.is_open ? 'close-circle-outline' : 'checkmark-circle-outline'}
            size={20}
            color="#2196F3"
          />
          <Text style={styles.toggleButtonText}>
            {item.is_open ? 'Close' : 'Open'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteRestaurant(item.id, item.name)}
          disabled={deleting === item.id}
        >
          {deleting === item.id ? (
            <ActivityIndicator size="small" color="#F44336" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color="#F44336" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manage Restaurants</Text>
        <Text style={styles.headerSubtitle}>{restaurants.length} restaurants</Text>
      </View>

      <FlatList
        data={restaurants}
        renderItem={renderRestaurant}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#210059']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No restaurants found</Text>
          </View>
        }
      />
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
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  restaurantCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  restaurantImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  restaurantAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  restaurantPhone: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleButton: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  toggleButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  deleteButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: '#999',
    fontWeight: '600',
  },
});
