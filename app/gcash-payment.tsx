import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../utils/api';
import { useCartStore } from '../store/cartStore';

export default function GCashPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { clearCart } = useCartStore();
  
  const orderId = params.orderId as string;
  const amount = params.amount as string;

  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initiatePayment();
  }, []);

  const initiatePayment = async () => {
    setLoading(true);
    try {
      const response = await api.post('/payments/gcash/initiate', {
        order_id: orderId,
        customer_gcash_number: '09609317687', // Can be dynamic in future
      });
      setPaymentData(response.data);
    } catch (error: any) {
      console.error('Failed to initiate payment:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to initiate payment. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to initiate payment. Please try again.');
      }
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      if (Platform.OS === 'web') {
        window.alert('Permission to access camera roll is required!');
      } else {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPaymentProof(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const submitPayment = async () => {
    if (!paymentProof) {
      if (Platform.OS === 'web') {
        window.alert('Please upload payment proof screenshot');
      } else {
        Alert.alert('Required', 'Please upload payment proof screenshot');
      }
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/payments/gcash/verify', {
        payment_id: paymentData.payment_id,
        payment_proof_base64: paymentProof,
      });

      clearCart();
      router.replace(`/order-confirmation?orderId=${orderId}` as any);
    } catch (error: any) {
      console.error('Payment submission failed:', error);
      if (Platform.OS === 'web') {
        window.alert('Payment submission failed. Please try again.');
      } else {
        Alert.alert('Error', 'Payment submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Initiating GCash payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!paymentData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#210059" />
          <Text style={styles.errorText}>Failed to load payment details</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GCash Payment</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount to Pay</Text>
          <Text style={styles.amountValue}>₱{amount}</Text>
          <View style={styles.referenceContainer}>
            <Text style={styles.referenceLabel}>Reference Number:</Text>
            <Text style={styles.referenceValue}>{paymentData.reference_number}</Text>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={24} color="#0066CC" />
            <Text style={styles.sectionTitle}>Payment Instructions</Text>
          </View>

          {Object.keys(paymentData.payment_instructions).map((key, index) => (
            <View key={key} style={styles.instructionRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.instructionText}>
                {paymentData.payment_instructions[key]}
              </Text>
            </View>
          ))}
        </View>

        {/* GCash Details */}
        <View style={styles.section}>
          <View style={styles.gcashDetailsCard}>
            <View style={styles.gcashIcon}>
              <Text style={styles.gcashIconText}>G</Text>
            </View>
            <View style={styles.gcashDetails}>
              <Text style={styles.gcashLabel}>Send to GCash Number</Text>
              <Text style={styles.gcashNumber}>{paymentData.merchant_gcash_number}</Text>
              <Text style={styles.gcashAmount}>Amount: ₱{amount}</Text>
            </View>
          </View>
        </View>

        {/* Upload Proof */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="camera-outline" size={24} color="#0066CC" />
            <Text style={styles.sectionTitle}>Upload Payment Proof</Text>
          </View>

          {paymentProof ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: paymentProof }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={pickImage}
              >
                <Ionicons name="pencil" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Ionicons name="cloud-upload-outline" size={32} color="#0066CC" />
              <Text style={styles.uploadButtonText}>Upload Screenshot</Text>
              <Text style={styles.uploadButtonSubtext}>
                Take a screenshot of your successful GCash transaction
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Important Note */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={24} color="#FF9800" />
          <Text style={styles.noteText}>
            Make sure your payment screenshot clearly shows the transaction details including
            amount, reference number, and date.
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!paymentProof || submitting) && styles.submitButtonDisabled]}
          onPress={submitPayment}
          disabled={!paymentProof || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Submit Payment</Text>
              <Text style={styles.submitButtonSubtext}>Confirm your GCash payment</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#210059',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  amountCard: {
    backgroundColor: '#0066CC',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
  },
  amountValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    marginVertical: 8,
  },
  referenceContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    width: '100%',
  },
  referenceLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.9,
  },
  referenceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    paddingTop: 6,
  },
  gcashDetailsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0066CC',
  },
  gcashIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  gcashIconText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  gcashDetails: {
    flex: 1,
  },
  gcashLabel: {
    fontSize: 12,
    color: '#666',
  },
  gcashNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066CC',
    marginVertical: 4,
  },
  gcashAmount: {
    fontSize: 14,
    color: '#666',
  },
  uploadButton: {
    padding: 32,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0066CC',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066CC',
    marginTop: 12,
  },
  uploadButtonSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  changeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    marginBottom: 16,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#F57C00',
    marginLeft: 12,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: '#0066CC',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  submitButtonSubtext: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 4,
    opacity: 0.9,
  },
});
