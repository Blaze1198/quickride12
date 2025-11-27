import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Helper function to get maneuver icon
export const getManeuverIcon = (maneuver: string): any => {
  const iconMap: { [key: string]: any } = {
    'turn-left': 'arrow-back',
    'turn-right': 'arrow-forward',
    'turn-slight-left': 'arrow-back',
    'turn-slight-right': 'arrow-forward',
    'turn-sharp-left': 'arrow-back',
    'turn-sharp-right': 'arrow-forward',
    'uturn-left': 'return-down-back',
    'uturn-right': 'return-down-forward',
    'merge': 'git-merge',
    'fork-left': 'git-branch',
    'fork-right': 'git-branch',
    'keep-left': 'arrow-back',
    'keep-right': 'arrow-forward',
    'ramp-left': 'arrow-back',
    'ramp-right': 'arrow-forward',
    'roundabout-left': 'sync',
    'roundabout-right': 'sync',
    'straight': 'arrow-up',
    'ferry': 'boat',
  };
  
  return iconMap[maneuver] || 'arrow-up';
};

// 1. ETA & Distance Display Component
interface ETADisplayProps {
  eta: string;
  distance: string;
}

export const ETADisplay: React.FC<ETADisplayProps> = ({ eta, distance }) => {
  return (
    <View style={styles.etaContainer}>
      <View style={styles.etaContent}>
        <View style={styles.etaItem}>
          <Ionicons name="time-outline" size={20} color="#FFF" />
          <Text style={styles.etaText}>{eta}</Text>
        </View>
        <View style={styles.etaDivider} />
        <View style={styles.etaItem}>
          <Ionicons name="navigate-outline" size={20} color="#FFF" />
          <Text style={styles.etaText}>{distance}</Text>
        </View>
      </View>
    </View>
  );
};

// 2. Turn-by-Turn Instructions Component
interface TurnByTurnProps {
  currentStep: any;
}

export const TurnByTurnInstructions: React.FC<TurnByTurnProps> = ({ currentStep }) => {
  if (!currentStep) return null;

  const maneuverIcon = getManeuverIcon(currentStep.maneuver || 'straight');
  const instruction = currentStep.instructions?.replace(/<[^>]*>/g, '') || 'Continue straight';
  const distance = currentStep.distance?.text || '';

  return (
    <View style={styles.instructionCard}>
      <View style={styles.instructionIcon}>
        <Ionicons name={maneuverIcon} size={32} color="#4285F4" />
      </View>
      <View style={styles.instructionContent}>
        <Text style={styles.instructionDistance}>{distance}</Text>
        <Text style={styles.instructionText} numberOfLines={2}>
          {instruction}
        </Text>
      </View>
    </View>
  );
};

// 6. Recenter Button Component
interface RecenterButtonProps {
  onPress: () => void;
}

export const RecenterButton: React.FC<RecenterButtonProps> = ({ onPress }) => {
  const handlePress = () => {
    console.log('🔘 RecenterButton component clicked!');
    if (onPress) {
      onPress();
    } else {
      console.log('❌ No onPress handler provided to RecenterButton');
    }
  };

  return (
    <Pressable 
      style={styles.recenterButton} 
      onPress={handlePress}
      onPressIn={() => console.log('👆 Button press detected')}
    >
      <Ionicons name="locate" size={24} color="#4285F4" />
    </Pressable>
  );
};

// 8. Alternative Routes Component
interface AlternativeRoutesProps {
  routes: any[];
  selectedIndex: number;
  onSelectRoute: (index: number) => void;
}

export const AlternativeRoutes: React.FC<AlternativeRoutesProps> = ({
  routes,
  selectedIndex,
  onSelectRoute,
}) => {
  if (!routes || routes.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.routesContainer}
      contentContainerStyle={styles.routesContent}
    >
      {routes.map((route, index) => {
        const leg = route.legs[0];
        const duration = Math.ceil(leg.duration.value / 60);
        const distance = (leg.distance.value / 1000).toFixed(1);
        const isSelected = index === selectedIndex;

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.routeCard,
              isSelected && styles.routeCardSelected,
            ]}
            onPress={() => onSelectRoute(index)}
          >
            <Text style={[styles.routeTitle, isSelected && styles.routeTitleSelected]}>
              Route {index + 1}
            </Text>
            <View style={styles.routeInfo}>
              <Ionicons
                name="time-outline"
                size={14}
                color={isSelected ? '#4285F4' : '#666'}
              />
              <Text style={[styles.routeText, isSelected && styles.routeTextSelected]}>
                {duration} min
              </Text>
            </View>
            <View style={styles.routeInfo}>
              <Ionicons
                name="navigate-outline"
                size={14}
                color={isSelected ? '#4285F4' : '#666'}
              />
              <Text style={[styles.routeText, isSelected && styles.routeTextSelected]}>
                {distance} km
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// 9. Lane Guidance Component
interface LaneGuidanceProps {
  laneInfo: any;
}

export const LaneGuidance: React.FC<LaneGuidanceProps> = ({ laneInfo }) => {
  if (!laneInfo || !laneInfo.length) return null;

  return (
    <View style={styles.laneContainer}>
      <Text style={styles.laneTitle}>Choose lane:</Text>
      <View style={styles.laneIcons}>
        {laneInfo.map((lane: any, index: number) => {
          const isRecommended = lane.active;
          return (
            <View
              key={index}
              style={[
                styles.laneArrow,
                isRecommended && styles.laneArrowActive,
              ]}
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={isRecommended ? '#4285F4' : '#999'}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
};

// 13. Progress Bar Component
interface ProgressBarProps {
  progress: number; // 0-100
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarBackground}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${clampedProgress}%` },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // ETA Display Styles
  etaContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  etaContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  etaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  etaDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 16,
  },
  etaText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },

  // Turn-by-Turn Instructions Styles
  instructionCard: {
    position: 'absolute',
    top: 140,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 9,
  },
  instructionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionContent: {
    flex: 1,
  },
  instructionDistance: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },

  // Recenter Button Styles
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
    cursor: 'pointer' as any, // Make it clickable on web
  },

  // Alternative Routes Styles
  routesContainer: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    zIndex: 8,
  },
  routesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  routeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    minWidth: 100,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  routeCardSelected: {
    borderColor: '#4285F4',
    backgroundColor: '#E3F2FD',
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  routeTitleSelected: {
    color: '#4285F4',
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  routeText: {
    fontSize: 12,
    color: '#666',
  },
  routeTextSelected: {
    color: '#4285F4',
    fontWeight: '600',
  },

  // Lane Guidance Styles
  laneContainer: {
    position: 'absolute',
    top: 240,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 8,
  },
  laneTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  laneIcons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  laneArrow: {
    width: 32,
    height: 40,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  laneArrowActive: {
    borderColor: '#4285F4',
    backgroundColor: '#E3F2FD',
  },

  // Progress Bar Styles
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4285F4',
  },
});
