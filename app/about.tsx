import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Ionicons name="bicycle" size={60} color="#210059" />
          </View>
          <Text style={styles.appName}>QuickRide</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.description}>
            QuickRide is your favorite delivery service platform in the Philippines. 
            Order food from the best restaurants and get it delivered fast to your doorstep!
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          
          <View style={styles.featureRow}>
            <Ionicons name="flash" size={20} color="#210059" />
            <Text style={styles.featureText}>Fast delivery within 30 minutes</Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="restaurant" size={20} color="#210059" />
            <Text style={styles.featureText}>Wide selection of restaurants</Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="location" size={20} color="#210059" />
            <Text style={styles.featureText}>Real-time order tracking</Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="card" size={20} color="#210059" />
            <Text style={styles.featureText}>Multiple payment options</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.copyright}>© 2025 QuickRide Philippines</Text>
          <Text style={styles.rights}>All rights reserved</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFF',
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#999',
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 12,
    padding: 16,
  },
  description: {
    fontSize: 15,
    color: '#666',
    lineHeight: 24,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#666',
  },
  copyright: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  rights: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});