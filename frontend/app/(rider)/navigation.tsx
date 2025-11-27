import React, { lazy, Suspense } from 'react';
import { Platform, View, Text, ActivityIndicator, StyleSheet } from 'react-native';

// Lazy load platform-specific implementations
// This prevents react-native-maps from being imported on web
const WebNavigation = lazy(() => import('./navigation.web'));
const NativeNavigation = lazy(() => import('./navigation.native'));

const LoadingScreen = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color="#4285F4" />
    <Text style={styles.loadingText}>Loading navigation...</Text>
  </View>
);

export default function RiderNavigationScreen() {
  const NavigationComponent = Platform.OS === 'web' ? WebNavigation : NativeNavigation;
  
  return (
    <Suspense fallback={<LoadingScreen />}>
      <NavigationComponent />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});

