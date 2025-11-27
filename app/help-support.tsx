import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function HelpSupportScreen() {
  const router = useRouter();

  const handleContact = (type: string) => {
    if (type === 'email') {
      Linking.openURL('mailto:support@quickride.ph');
    } else if (type === 'phone') {
      Linking.openURL('tel:+639171234567');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          
          <TouchableOpacity style={styles.contactCard} onPress={() => handleContact('email')}>
            <View style={styles.contactIcon}>
              <Ionicons name="mail" size={24} color="#210059" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Email Support</Text>
              <Text style={styles.contactSubtext}>support@quickride.ph</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={() => handleContact('phone')}>
            <View style={styles.contactIcon}>
              <Ionicons name="call" size={24} color="#4CAF50" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Phone Support</Text>
              <Text style={styles.contactSubtext}>+63 917 123 4567</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operating Hours</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>Monday - Sunday</Text>
            <Text style={styles.infoValue}>9:00 AM - 9:00 PM</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          <View style={styles.faqCard}>
            <Text style={styles.faqQuestion}>How do I track my order?</Text>
            <Text style={styles.faqAnswer}>Go to 'My Orders' tab and click on your active order to see real-time tracking.</Text>
          </View>

          <View style={styles.faqCard}>
            <Text style={styles.faqQuestion}>How can I cancel my order?</Text>
            <Text style={styles.faqAnswer}>You can cancel your order before it's accepted by a rider. Go to the order details and tap 'Cancel Order'.</Text>
          </View>

          <View style={styles.faqCard}>
            <Text style={styles.faqQuestion}>What payment methods do you accept?</Text>
            <Text style={styles.faqAnswer}>We accept GCash, Credit/Debit Cards, and Cash on Delivery.</Text>
          </View>
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
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  contactSubtext: {
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  faqCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});