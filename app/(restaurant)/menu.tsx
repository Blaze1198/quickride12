import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  available: boolean;
  image_base64?: string;
}

interface Restaurant {
  id: string;
  name: string;
  menu: MenuItem[];
}

const CATEGORIES = [
  'Appetizers',
  'Main Course',
  'Desserts',
  'Drinks',
  'Sides',
  'Snacks',
];

export default function RestaurantMenuScreen() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formImage, setFormImage] = useState<string | null>(null);

  useEffect(() => {
    fetchRestaurant();
  }, []);

  const fetchRestaurant = async () => {
    try {
      const response = await api.get('/restaurants/owner/my');
      setRestaurant(response.data);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRestaurant();
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormDescription('');
    setFormPrice('');
    setFormCategory(CATEGORIES[0]);
    setFormImage(null);
    setModalVisible(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormDescription(item.description || '');
    setFormPrice(item.price.toString());
    setFormCategory(item.category);
    setFormImage(item.image_base64 || null);
    setModalVisible(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
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
    if (!formName || !formPrice || !restaurant) {
      if (Platform.OS === 'web') {
        window.alert('Please fill in required fields');
      } else {
        alert('Please fill in required fields');
      }
      return;
    }

    try {
      const itemData = {
        name: formName,
        description: formDescription,
        price: parseFloat(formPrice),
        category: formCategory,
        available: true,
        image_base64: formImage,
      };

      if (editingItem) {
        // Update existing item
        await api.put(`/restaurants/${restaurant.id}/menu-items/${editingItem.id}`, itemData);
      } else {
        // Add new item
        await api.post(`/restaurants/${restaurant.id}/menu-items`, itemData);
      }

      setModalVisible(false);
      fetchRestaurant();
    } catch (error) {
      console.error('Error saving menu item:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save menu item');
      } else {
        alert('Failed to save menu item');
      }
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    if (!restaurant) return;

    try {
      await api.put(`/restaurants/${restaurant.id}/menu-items/${item.id}`, {
        available: !item.available,
      });
      fetchRestaurant();
    } catch (error) {
      console.error('Error toggling availability:', error);
    }
  };

  const deleteItem = async (item: MenuItem) => {
    if (!restaurant) return;

    const confirmDelete = Platform.OS === 'web' 
      ? window.confirm(`Delete ${item.name}?`)
      : true;

    if (confirmDelete) {
      try {
        await api.delete(`/restaurants/${restaurant.id}/menu-items/${item.id}`);
        fetchRestaurant();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const filteredMenu = restaurant?.menu.filter(item => 
    selectedCategory === 'All' || item.category === selectedCategory
  ) || [];

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.menuCard}>
      <View style={styles.menuCardContent}>
        {item.image_base64 && (
          <Image source={{ uri: item.image_base64 }} style={styles.menuImage} />
        )}
        <View style={styles.menuInfo}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.availabilityBadge}>
              <View style={[styles.statusDot, { backgroundColor: item.available ? '#4CAF50' : '#999' }]} />
              <Text style={styles.availabilityText}>
                {item.available ? 'Available' : 'Out of stock'}
              </Text>
            </View>
          </View>
          {item.description && (
            <Text style={styles.menuDescription} numberOfLines={2}>{item.description}</Text>
          )}
          <View style={styles.menuFooter}>
            <Text style={styles.menuPrice}>₱{item.price.toFixed(2)}</Text>
            <Text style={styles.menuCategory}>{item.category}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.menuActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleAvailability(item)}
        >
          <Ionicons 
            name={item.available ? 'eye-off-outline' : 'eye-outline'} 
            size={20} 
            color="#666" 
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="create-outline" size={20} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => deleteItem(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#F44336" />
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

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No restaurant found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Menu Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <TouchableOpacity
          style={[styles.categoryChip, selectedCategory === 'All' && styles.categoryChipActive]}
          onPress={() => setSelectedCategory('All')}
        >
          <Text style={[styles.categoryText, selectedCategory === 'All' && styles.categoryTextActive]}>
            All ({restaurant.menu.length})
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map(category => {
          const count = restaurant.menu.filter(item => item.category === category).length;
          if (count === 0) return null;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
                {category} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filteredMenu}
        renderItem={renderMenuItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#210059']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No menu items yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first item</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="Item name"
                placeholderTextColor="#999"
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Item description"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Price (₱) *</Text>
              <TextInput
                style={styles.input}
                value={formPrice}
                onChangeText={setFormPrice}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Category *</Text>
              <View style={styles.categorySelector}>
                {CATEGORIES.map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categorySelectorChip,
                      formCategory === category && styles.categorySelectorChipActive
                    ]}
                    onPress={() => setFormCategory(category)}
                  >
                    <Text style={[
                      styles.categorySelectorText,
                      formCategory === category && styles.categorySelectorTextActive
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Image</Text>
              <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                {formImage ? (
                  <Image source={{ uri: formImage }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={32} color="#999" />
                    <Text style={styles.imagePlaceholderText}>Tap to select image</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#210059',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryScroll: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxHeight: 60,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#210059',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: 16,
  },
  menuCard: {
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
  menuCardContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  menuImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    marginRight: 12,
  },
  menuInfo: {
    flex: 1,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  menuName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  availabilityText: {
    fontSize: 10,
    color: '#666',
  },
  menuDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  menuFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#210059',
  },
  menuCategory: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  menuActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#CCC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
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
    height: 80,
    textAlignVertical: 'top',
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categorySelectorChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categorySelectorChipActive: {
    backgroundColor: '#210059',
    borderColor: '#210059',
  },
  categorySelectorText: {
    fontSize: 14,
    color: '#666',
  },
  categorySelectorTextActive: {
    color: '#FFF',
  },
  imagePickerButton: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#210059',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
