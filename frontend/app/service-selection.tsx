import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function ServiceSelectionScreen() {
  const router = useRouter();

  const handleServiceSelect = (service: 'food' | 'ride') => {
    if (service === 'food') {
      router.replace('/(customer)');
    } else {
      router.replace('/ride-booking');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose a Service</Text>
          <Text style={styles.subtitle}>What would you like to do today?</Text>
        </View>

        <View style={styles.servicesContainer}>
          {/* Food Delivery Service */}
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => handleServiceSelect('food')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF8E53']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCard}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="fast-food" size={64} color="#FFF" />
              </View>
              <Text style={styles.serviceTitle}>Food Delivery</Text>
              <Text style={styles.serviceDescription}>
                Order from your favorite restaurants
              </Text>
              <View style={styles.serviceFeatures}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Text style={styles.featureText}>Quick delivery</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Text style={styles.featureText}>Track your order</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Text style={styles.featureText}>Multiple restaurants</Text>
                </View>
              </View>
              <View style={styles.arrowButton}>
                <Ionicons name="arrow-forward" size={24} color="#FFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Ride Service */}
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => handleServiceSelect('ride')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#2196F3', '#42A5F5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCard}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="bicycle" size={64} color="#FFF" />
              </View>
              <Text style={styles.serviceTitle}>Moto-Taxi Ride</Text>
              <Text style={styles.serviceDescription}>
                Fast and affordable motorcycle rides
              </Text>
              <View style={styles.serviceFeatures}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Text style={styles.featureText}>₱30 base fare</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Text style={styles.featureText}>Live tracking</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Text style={styles.featureText}>Schedule rides</Text>
                </View>
              </View>
              <View style={styles.arrowButton}>
                <Ionicons name="arrow-forward" size={24} color="#FFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.switchContainer}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.switchText}>
            You can switch between services anytime
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  servicesContainer: {
    flex: 1,
    gap: 20,
  },
  serviceCard: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  gradientCard: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  iconContainer: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  serviceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  serviceDescription: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 20,
  },
  serviceFeatures: {
    gap: 12,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  arrowButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginTop: 20,
  },
  switchText: {
    fontSize: 14,
    color: '#666',
  },
});
