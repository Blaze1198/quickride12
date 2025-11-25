# Real-Time Rider Marker Movement

## Feature Overview
The rider marker now moves smoothly in real-time as the rider travels, just like Google Maps navigation. The marker position updates automatically every 5 seconds with smooth animations.

## Implementation Details

### 1. Marker Reference Storage
**File:** `/app/frontend/app/(rider)/navigation.tsx`  
**Lines:** 605-608

When the map initializes, the rider marker is now stored in `riderMarkerRef.current` so it can be updated later:

```typescript
const riderMarker = new google.maps.Marker({
  position: userPosition,
  map,
  icon: {
    url: createRiderArrowIcon(),
    scaledSize: new google.maps.Size(80, 100),
    anchor: new google.maps.Point(40, 50),
  },
  title: 'Your Location (Rider)',
  zIndex: 1000,
});

// Store rider marker in ref so it can be updated later
riderMarkerRef.current = riderMarker;
```

### 2. Real-Time Position Updates
**File:** `/app/frontend/app/(rider)/navigation.tsx`  
**Lines:** 1399-1461

A new `useEffect` hook listens to `userLocation` changes and updates the marker position with smooth animation:

```typescript
useEffect(() => {
  if (!userLocation || !mapInstanceRef.current || !riderMarkerRef.current) return;
  
  const google = (window as any).google;
  if (!google || !google.maps) return;
  
  const newPosition = new google.maps.LatLng(userLocation.latitude, userLocation.longitude);
  
  // Calculate bearing (direction of travel)
  let bearing = currentBearing;
  if (previousLocationRef.current) {
    const prevLatLng = new google.maps.LatLng(
      previousLocationRef.current.latitude,
      previousLocationRef.current.longitude
    );
    bearing = google.maps.geometry.spherical.computeHeading(prevLatLng, newPosition);
    setCurrentBearing(bearing);
  }
  previousLocationRef.current = userLocation;
  
  // Smoothly animate marker to new position
  const oldPosition = riderMarkerRef.current.getPosition();
  if (oldPosition) {
    // Animate marker movement over 1 second (30 steps)
    const steps = 30;
    const latStep = (newPosition.lat() - oldPosition.lat()) / steps;
    const lngStep = (newPosition.lng() - oldPosition.lng()) / steps;
    
    let currentStep = 0;
    const animationInterval = setInterval(() => {
      currentStep++;
      const interpolatedLat = oldPosition.lat() + (latStep * currentStep);
      const interpolatedLng = oldPosition.lng() + (lngStep * currentStep);
      const interpolatedPosition = new google.maps.LatLng(interpolatedLat, interpolatedLng);
      
      riderMarkerRef.current.setPosition(interpolatedPosition);
      
      // Also update rotation to match direction
      const icon = riderMarkerRef.current.getIcon();
      if (icon && typeof icon === 'object' && bearing !== 0) {
        riderMarkerRef.current.setIcon({
          ...icon,
          rotation: bearing,
        });
      }
      
      if (currentStep >= steps) {
        clearInterval(animationInterval);
      }
    }, 1000 / steps); // Complete animation in ~1 second
  }
  
  // Pan map to follow rider (only if not in active navigation mode)
  if (!isNavigating && mapInstanceRef.current) {
    mapInstanceRef.current.panTo(newPosition);
  }
}, [userLocation, currentBearing, isNavigating]);
```

## Key Features

### Smooth Animation
- **30-step interpolation** over 1 second
- Marker glides smoothly from old position to new position
- No jarring jumps or teleportation

### Direction Tracking
- Calculates bearing (direction of travel) using previous location
- Rotates marker icon to point in the direction of movement
- Updates the spotlight/cone to match travel direction

### Camera Follow
- Map automatically pans to keep rider centered
- Only activates when NOT in active navigation mode (to avoid conflicts)
- Smooth pan transition using `panTo()`

### Update Frequency
- Location fetched every 5 seconds (set in line 161)
- Backend receives location updates every 5 seconds (line 178)
- Marker animates smoothly between each update

## Visual Result

**Before:** Marker stayed static, only jumped to new positions without animation

**After:** 
- ✅ Marker smoothly glides to new positions
- ✅ Rotates to face direction of travel
- ✅ Map follows rider automatically
- ✅ Mimics native Google Maps navigation behavior

## Testing

To verify the feature:
1. Login as a rider
2. Accept an active delivery job
3. Wait for location updates (every 5 seconds)
4. Observe:
   - Marker smoothly moves to new positions
   - Marker rotates based on direction
   - Map follows marker position
   - Animation completes in ~1 second

## Dependencies

- **Google Maps JavaScript API:** geometry library for bearing calculations
- **React useEffect:** Triggers on userLocation changes
- **Refs:** `riderMarkerRef`, `previousLocationRef`, `mapInstanceRef`
- **State:** `userLocation`, `currentBearing`, `isNavigating`

## Performance

- **Efficient:** Uses `setInterval` for smooth interpolation
- **Memory Safe:** Clears interval after animation completes
- **Conditional:** Only runs when all required refs and states are available
- **Non-blocking:** Animation runs independently without blocking UI
