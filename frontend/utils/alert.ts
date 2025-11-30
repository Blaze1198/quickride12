import { Alert, Platform } from 'react-native';

/**
 * Platform-safe alert function
 * Uses React Native Alert on mobile, window.alert on web
 */
export const showAlert = (title: string, message?: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Web: use window.alert
    const fullMessage = message ? `${title}\n\n${message}` : title;
    window.alert(fullMessage);
  } else {
    // Native: use React Native Alert
    if (message) {
      Alert.alert(title, message);
    } else {
      Alert.alert('Alert', title);
    }
  }
};

export default showAlert;
