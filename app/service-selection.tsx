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
      <LinearGradient
        colors={['#F5F5F5', '#FFFFFF', '#F5F5F5']}
        style={styles.gradientBackground}
      >
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
              colors={['#210059', '#5B21B6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientCard}
            >
              <View style={styles.cardContent}>
                <Ionicons name="fast-food" size={48} color="#FFF" />
                <Text style={styles.serviceTitle}>Food Delivery</Text>
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
              <View style={styles.cardContent}>
                <Ionicons name="bicycle" size={48} color="#FFF" />
                <Text style={styles.serviceTitle}>Moto-Taxi Ride</Text>
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
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  gradientBackground: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 20,
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  servicesContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  serviceCard: {
    width: '90%',
    maxWidth: 400,
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  gradientCard: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    alignItems: 'center',
    gap: 16,
  },
  serviceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  switchText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
});
