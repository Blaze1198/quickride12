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
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
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
          ...restaurant.location,
          address: formAddress,
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
          <ActivityIndicator size="large" color="#FF6B6B" />
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
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formAddress}
                onChangeText={setFormAddress}
                placeholder="Enter full address"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={styles.value}>{restaurant.location.address}</Text>
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
              <Ionicons name="time-outline" size={24} color="#FF6B6B" />
              <Text style={styles.infoLabel}>Prep Time</Text>
              <Text style={styles.infoValue}>20-30 min</Text>
            </View>
          </View>
        )}
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
    backgroundColor: '#FF6B6B',
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
});
