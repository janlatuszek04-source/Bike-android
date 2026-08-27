# Implementation Plans & Technical Problem History

This document records technical problems identified during development and the solutions implemented in the **BikeTracker** (Bike-android) codebase.

> **Rule for Agent / Contributor**: Always append new technical problem entries and implementation plans to this document instead of rewriting or deleting the existing history.

---

## 1. Summary of Resolved Problems

| # | Problem | Root Cause | Implemented Solution | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Missing Web Map Tiles (Black Grid)** | `src/components/RouteMap.web.tsx` used a CSS linear-gradient mock instead of fetching real tiles. | Integrated interactive Leaflet.js with OpenStreetMap raster tiles (`tile.openstreetmap.org`) and standardized default center on Kraków (`50.0647, 19.9450`). | ✅ **Resolved** |
| **2** | **Unlabeled Center Location Marker** | Static 14px dot without labels, heading context, or dynamic status. | Created animated radar pulse marker with "📍 Current Location" badge for live rides, and Start 🚩 / Finish 🏁 pins for history views. | ✅ **Resolved** |
| **3** | **Unreadable Telemetry Graph** | Graph had overlapping text blocks, raw second intervals, and lacked metric downsampling. | Refactored `app/ride/[id].tsx` with distance-based X-axis (km), stride formatting, and structured Telemetry Analysis cards. | ✅ **Resolved** |
| **4** | **Android Expo Go Map Black Screen & Flickering** | 1. Missing Google Maps API key in `app.json`.<br>2. Controlled `region` prop churn destroying camera on every GPS tick.<br>3. Fabric SurfaceView z-fighting in Expo Go. | **Implemented Strategy A**: Unified cross-platform Leaflet + OpenStreetMap engine in `src/components/RouteMap.native.tsx` via `react-native-webview`. Uses `injectJavaScript` action bridge for 60 FPS smooth panning with zero Google Cloud API keys needed. | ✅ **Resolved** |
| **5** | **Missing Manual GPS Locate Me Button & Pre-Start Centering** | No one-time geolocation query in idle mode; missing floating locate button and imperative fly-to bridge action. | Added `getCurrentLocation()` in `locationService.ts`, auto-mount geolocation in `useRideRecorder.ts`, `RECENTER_ON_LOCATION` bridge action (`map.flyTo`), and discreet bottom-right circular button (`LocateFixed`). | ✅ **Resolved** |

---

## 2. Current Architecture & Conventions

1. **Mapping Engine (Cross-Platform Parity)**:
   - **Web**: [RouteMap.web.tsx](file:///C:/Users/Jan/WebstormProjects/Bike-android/src/components/RouteMap.web.tsx) (Leaflet DOM + OpenStreetMap).
   - **Android & iOS**: [RouteMap.native.tsx](file:///C:/Users/Jan/WebstormProjects/Bike-android/src/components/RouteMap.native.tsx) (`react-native-webview` + Leaflet + OpenStreetMap).
   - **Bridge Protocol**: React Native streams updates into the embedded map via `injectJavaScript` (`UPDATE_ROUTE`, `UPDATE_USER_LOCATION`, `SET_START_FINISH`, `RECENTER_ON_LOCATION`) without component remounts or view flickering.
   - **Zero Configuration**: Eliminates dependency on Google Cloud Console billing, SHA-1 certificates, and Google Play Services API keys.

2. **GPS & Telemetry**:
   - Jitter filtering: accuracy threshold $\le 20\text{m}$, movement threshold $\ge 3\text{m}$ (Haversine formula in `src/utils/geo.ts`).
   - State management: `useRideRecorder.ts` handles `idle` | `recording` | `paused` lifecycles + `previewLocation` & `locateMe()`.

3. **Storage**:
   - AsyncStorage key: `biketracker.rides.v1` via `src/utils/storage.ts`.

---

## 3. [Resolved] Manual GPS "Locate Me" Button & Pre-Start Centering

### 3.1 Problem Statement
Currently, there is no manual "GPS / Locate Me" button in the application UI:
- **Default Hardcoded Coordinates on Launch**: When a user opens the app in `idle` state, the map defaults to Kraków center (`50.0647, 19.9450`) because continuous GPS tracking only starts after tapping **START**.
- **No Manual Re-centering**: When recording a ride or exploring the map, if the user manually pans or zooms away from their current position, there is no quick-action button to snap the camera back to their real-time location.
- **Inability to Verify GPS Reception Before Recording**: Cyclists cannot verify GPS satellite lock or accuracy before starting a recording session.

---

### 3.2 Technical Root Cause Analysis

1. **Absence of a One-Time Location Query Mechanism**:
   - `src/utils/locationService.ts` and `src/hooks/useRideRecorder.ts` only subscribe to continuous location streams (`Location.watchPositionAsync`) during `recording` state.
   - There is no one-time location query (`Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })`) on initial app mount or via manual request.
2. **Missing Floating Action Button (FAB) in UI**:
   - [app/(tabs)/index.tsx](file:///C:/Users/Jan/WebstormProjects/Bike-android/app/(tabs)/index.tsx) does not include a floating "Locate Me" icon button overlaid on the map container.
3. **Map Bridge Lacks Imperative Re-center / Fly-To Dispatcher**:
   - Neither [RouteMap.native.tsx](file:///C:/Users/Jan/WebstormProjects/Bike-android/src/components/RouteMap.native.tsx) nor [RouteMap.web.tsx](file:///C:/Users/Jan/WebstormProjects/Bike-android/src/components/RouteMap.web.tsx) accepts an imperative `recenter()` command or dispatches a `map.flyTo([lat, lon], 16)` action to dynamically reposition the camera outside of the standard `props.follow` stream.
4. **Decoupled Pre-Start State**:
   - In `idle` state, `stats.lastPoint` is `null`, which causes the map to fall back to hardcoded default coordinates rather than the user's actual device location.

---

### 3.3 Proposed Target Solution & Architectural Design

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            MANUAL GPS "LOCATE ME" ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  UI Layer (app/(tabs)/index.tsx)                                                            │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ • Discreet Floating Button in bottom-right corner (38x38px, translucent slate #0F172A) │  │
│  │ • Auto-trigger location fetch on component mount (in idle mode)                       │  │
│  │ • Loading state feedback (<ActivityIndicator /> inside button during GPS acquisition) │  │
│  └───────────────────────────────────┬───────────────────────────────────────────────────┘  │
│                                      │ triggers locateMe()                                  │
│                                      ▼                                                      │
│  Location Engine (useRideRecorder.ts / locationService.ts)                                  │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Request foreground permissions if not already granted                              │  │
│  │ 2. Call Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })   │  │
│  │ 3. Store previewLocation: LatLng & isLocating: boolean in hook state                  │  │
│  │ 4. Expose imperative locateMe() function                                              │  │
│  └───────────────────────────────────┬───────────────────────────────────────────────────┘  │
│                                      │ dispatch RECENTER_ON_LOCATION action                 │
│                                      ▼                                                      │
│  Leaflet Map Engine (RouteMap.native.tsx / RouteMap.web.tsx)                                │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ • Smooth camera fly-to: map.flyTo([lat, lon], 16, { animate: true, duration: 0.8 })    │  │
│  │ • Update or render live radar dot at current user coordinates                         │  │
│  └───────────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.4 File-by-File Detailed Code Specification

#### 1. `src/utils/locationService.ts`
Implement `getCurrentLocation()` to fetch a single high-accuracy GPS fix with permission handling and Web fallback:
```typescript
export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve({ latitude: 50.0647, longitude: 19.9450 }),
          { timeout: 5000, enableHighAccuracy: true }
        );
      } else {
        resolve({ latitude: 50.0647, longitude: 19.9450 });
      }
    });
  }

  const granted = await ensureLocationPermission();
  if (!granted) return null;

  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  } catch (err) {
    console.warn('Could not fetch current position:', err);
    return null;
  }
}
```

---

#### 2. `src/hooks/useRideRecorder.ts`
1. Add `previewLocation` (`LatLng | null`) and `isLocating` (`boolean`) states.
2. Automatically fetch location once on initial hook mount.
3. Expose `locateMe: () => Promise<LatLng | null>`:
```typescript
const [previewLocation, setPreviewLocation] = useState<LatLng | null>(null);
const [isLocating, setIsLocating] = useState(false);

const locateMe = useCallback(async (): Promise<LatLng | null> => {
  setIsLocating(true);
  try {
    const pos = await getCurrentLocation();
    if (pos) {
      setPreviewLocation(pos);
      return pos;
    }
  } catch (e) {
    console.warn('locateMe failed:', e);
  } finally {
    setIsLocating(false);
  }
  return null;
}, []);

// Auto-fetch on mount in idle mode
useEffect(() => {
  if (stateRef.current === 'idle') {
    locateMe();
  }
}, [locateMe]);
```

---

#### 3. `src/components/RouteMap.native.tsx` & `src/components/RouteMap.web.tsx`
Add a handler for `RECENTER_ON_LOCATION` in the Leaflet bridge script:
```javascript
else if (action.type === 'RECENTER_ON_LOCATION') {
  map.flyTo([p.lat, p.lon], 16, { animate: true, duration: 0.8 });
  if (!userMarker) {
    var liveIcon = L.divIcon({
      className: 'custom-live-marker-container',
      html: '<div class="custom-live-marker"><div class="live-label-pill">📍 Current Location</div><div class="live-radar-pulse"></div><div class="live-core-dot"></div></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    userMarker = L.marker([p.lat, p.lon], { icon: liveIcon }).addTo(map);
  } else {
    userMarker.setLatLng([p.lat, p.lon]);
  }
}
```

---

#### 4. `app/(tabs)/index.tsx`
Add the minimal, discreet floating button in the **bottom-right corner** of `styles.mapWrap`:

```tsx
import { LocateFixed } from 'lucide-react-native';

// Inside RecordRideScreen JSX, inside <View style={styles.mapWrap}>:
<TouchableOpacity
  style={styles.locateBtn}
  onPress={handleLocatePress}
  activeOpacity={0.7}
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
>
  {stats.isLocating ? (
    <ActivityIndicator size="small" color={theme.accent} />
  ) : (
    <LocateFixed size={18} color={theme.accent} />
  )}
</TouchableOpacity>
```

**Minimal & Discreet Styles**:
```typescript
locateBtn: {
  position: 'absolute',
  bottom: 16,
  right: 16,
  width: 38,
  height: 38,
  borderRadius: 19,
  backgroundColor: 'rgba(15, 23, 42, 0.78)',
  borderWidth: 1,
  borderColor: '#334155',
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.35,
  shadowRadius: 4,
  elevation: 4,
  zIndex: 20,
}
```

---

### 3.5 Edge Cases & Failure Mitigations

1. **Permission Denied or Location Services Disabled**:
   - If location permission is not granted, `getCurrentLocation()` gracefully returns `null` without throwing unhandled exceptions.
   - The map retains the default or last known position.
2. **Indoor GPS Delays**:
   - `Location.Accuracy.Balanced` is used for the single location fix rather than `BestForNavigation`, enabling rapid Wi-Fi/cellular triangulation ($< 1\text{s}$) rather than waiting $> 15\text{s}$ for GPS satellite locks indoors.
3. **Re-centering While Recording**:
   - If the user has panned away while recording, pressing the locate button retrieves the latest recorded track point (`stats.lastPoint`) or fresh coordinate, centers the camera, and restores auto-follow.

---

### 3.6 Step-by-Step Execution Phases & Rollout Plan

1. **Phase 1**: Add `getCurrentLocation()` helper in `src/utils/locationService.ts`.
2. **Phase 2**: Add `previewLocation`, `isLocating`, and `locateMe()` in `src/hooks/useRideRecorder.ts`.
3. **Phase 3**: Update `RouteMap.native.tsx` and `RouteMap.web.tsx` to handle `RECENTER_ON_LOCATION` and `recenterLocation` prop.
4. **Phase 4**: Add discreet floating button UI in `app/(tabs)/index.tsx` (bottom-right corner) with loading indicator.
5. **Phase 5**: Run `npm run typecheck` to verify TypeScript compliance with 0 errors.
6. **Phase 6**: Test on Android Expo Go and Web to confirm auto-centering on launch and manual re-centering behavior.

---

### 3.7 Verification & QA Checklist

- [x] **App Launch Auto-Centering**: Opening the app in `idle` mode immediately fetches device GPS and glides map to the user's location with the green radar dot.
- [x] **Manual Locate Tap**: Panning away from the user position and tapping the bottom-right button smoothly animates the camera back (`map.flyTo`).
- [x] **Loading Spinner**: The button displays a discreet mini `<ActivityIndicator />` while locating and reverts to `<LocateFixed />` once resolved.
- [x] **In-Ride Functionality**: Tapping the button while recording or paused re-aligns camera with current cyclist position.
- [x] **Visual Discretion**: Button stays compact ($38\times 38\text{px}$) in the bottom-right corner without overlapping dashboard metrics or blocking map interactions.

---

## 4. Active Problem: Abrupt Single-Frame Map Flight (Bell Curve Easing & Parabolic Altitude Arch)

### 4.1 Problem Statement
When triggering the manual "Locate Me" re-centering action from a distant location (e.g. initial launch from Kraków to user's real city, or when exploring the map), the camera transition currently feels like a rigid, single-frame snap or abrupt teleportation:
- **Instantaneous Snap**: The map cuts directly to the target location without spatial continuity, giving users no sense of direction or geographical displacement.
- **Linear / Non-Smooth Velocity**: Standard `panTo` / unconfigured `flyTo` lacks parabolic altitude curvature and bell-curve velocity dampening.
- **Tile Thrashing**: Flying across long distances at a fixed street zoom level (zoom 16) forces the renderer to request hundreds of high-resolution tiles simultaneously, causing render stalls, dropped frames, and visual flickering.

---

### 4.2 Mathematical Model & Physics of the Flight Curve

To create a realistic, high-performance flight animation, the camera trajectory is governed by two coupled functions over flight duration $T = 1.5\text{s}$:

```
     VELOCITY PROFILE v(t)                     ALTITUDE PROFILE z(t)
     (Bell-Curve Ease-in-Out)                  (Parabolic Zoom Arch)

 1.0 ┤       ╭───╮                         16 ┤ ──╮             ╭── (Street Level)
     │      ╭╯   ╰╮                           │   ╰╮           ╭╯
 0.5 ┤     ╭╯     ╰╮                       14 ┤    ╰╮         ╭╯
     │    ╭╯       ╰╮                         │     ╰╮       ╭╯
 0.0 ┴────╯─────────╰────                  12 ┴───────╰─────╯────── (Peak Altitude)
     t=0     t=T/2    t=T                     t=0     t=T/2    t=T
```

#### 1. Bell Curve Velocity Function:
$$v(t) = V_{\max} \cdot \sin^2\left(\frac{\pi t}{T}\right) \quad \text{for } t \in [0, T]$$
* **Takeoff ($t=0$)**: $v(0) = 0$, $a(0) = 0$ (gentle lift without abrupt jerk).
* **Mid-flight Peak ($t=T/2 = 0.75\text{s}$)**: $v(T/2) = V_{\max}$ (maximum translation speed).
* **Touchdown ($t=T = 1.5\text{s}$)**: $v(T) = 0$, $a(T) = 0$ (soft landing without bounce).

#### 2. Parabolic Altitude / Zoom Scaling Function:
$$z(t) = Z_{\text{target}} - \Delta Z \cdot 4 \cdot \frac{t}{T}\left(1 - \frac{t}{T}\right)$$
* $\Delta Z$ is the zoom delta dynamically computed from geographical distance $D$:
  $$\Delta Z(D) = \min\left(4, \max\left(0, \log_2\left(\frac{D}{100\text{m}}\right)\right)\right)$$
* **Short distance ($D < 200\text{m}$)**: $\Delta Z \approx 0 \implies$ smooth street-level glide at zoom 16 ($0.8\text{s}$).
* **Medium distance ($200\text{m} \le D < 2\text{km}$)**: $\Delta Z = 2 \implies$ pulls back to zoom 14 at peak, landing at zoom 16 ($1.2\text{s}$).
* **Long distance ($D \ge 2\text{km}$)**: $\Delta Z = 4 \implies$ pulls back to bird's-eye view (zoom 12) at peak, landing at zoom 16 ($1.5\text{s}$).

---

### 4.3 Technical Architecture & Implementation Details

#### 1. Leaflet `flyTo` Configuration Breakdown:
In Leaflet.js, `map.flyTo(latLng, zoom, options)` provides native parabolic trajectory calculations when provided with calibrated options:
* **`duration: 1.5`**: Swift flight duration (1.5 seconds) ensuring crisp responsiveness.
* **`easeLinearity: 0.2`**: Low linearity factor forces a pronounced bell-curve cubic-bezier easing curve rather than linear interpolation.
* **`curve: 1.42`**: Controls the curvature of the parabolic flight path ($1.42$ provides the optimal zoom-out arch without losing horizon context).
* **`maxZoom: 16`**: Target final zoom level over the cyclist's location.
* **`noMoveStart: false`**: Ensures map state events fire continuously throughout the flight to prevent gesture lockups.

#### 2. Concurrency & Race-Condition Management:
* **Animation Lock (`isFlying` flag)**: If the user taps the locate button repeatedly in rapid succession, cancel previous animation frames (`map.stop()`) and initiate a clean single trajectory to prevent camera jitter.
* **Stream Decoupling**: While `isFlying` is active, temporarily pause low-priority `UPDATE_USER_LOCATION` camera pans (`map.panTo`) until the flight completes, guaranteeing 60 FPS animation smoothness without competing camera updates.

---

### 4.4 File-by-File Detailed Code Specification

#### 1. `src/components/RouteMap.native.tsx`
Update the embedded HTML bridge script to implement adaptive distance scaling and bell-curve `flyTo`:
```javascript
else if (action.type === 'RECENTER_ON_LOCATION') {
  var targetLatLng = L.latLng(p.lat, p.lon);
  var currentCenter = map.getCenter();
  var distanceMeters = currentCenter.distanceTo(targetLatLng);

  // Compute adaptive flight parameters
  var duration = distanceMeters > 2000 ? 1.5 : (distanceMeters > 300 ? 1.2 : 0.8);
  var targetZoom = 16;

  map.stop(); // Cancel any ongoing flight/pan
  map.flyTo(targetLatLng, targetZoom, {
    animate: true,
    duration: duration,
    easeLinearity: 0.2,
    noMoveStart: false
  });

  if (!userMarker) {
    var liveIcon = L.divIcon({
      className: 'custom-live-marker-container',
      html: '<div class="custom-live-marker"><div class="live-label-pill">📍 Current Location</div><div class="live-radar-pulse"></div><div class="live-core-dot"></div></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    userMarker = L.marker(targetLatLng, { icon: liveIcon }).addTo(map);
  } else {
    userMarker.setLatLng(targetLatLng);
  }
}
```

---

#### 2. `src/components/RouteMap.web.tsx`
Apply matching adaptive parabolic flight logic in the React Web component:
```typescript
useEffect(() => {
  if (!mapRef.current || !window.L || !props.recenterLocation) return;
  const targetLatLng = window.L.latLng(props.recenterLocation.latitude, props.recenterLocation.longitude);
  const currentCenter = mapRef.current.getCenter();
  const distanceMeters = currentCenter.distanceTo(targetLatLng);

  const duration = distanceMeters > 2000 ? 1.5 : (distanceMeters > 300 ? 1.2 : 0.8);

  mapRef.current.stop();
  mapRef.current.flyTo(targetLatLng, 16, {
    animate: true,
    duration: duration,
    easeLinearity: 0.2,
    noMoveStart: false,
  });

  if (userMarkerRef.current) {
    userMarkerRef.current.setLatLng(targetLatLng);
  } else if (props.showUserDot) {
    userMarkerRef.current = window.L.marker(targetLatLng, { icon: createLiveUserIcon() }).addTo(mapRef.current);
  }
}, [props.recenterLocation, props.showUserDot]);
```

---

### 4.5 Step-by-Step Execution Phases & Rollout Plan

1. **Phase 1: Code Implementation**:
   - Update `src/components/RouteMap.native.tsx` with adaptive distance calculation and bell-curve `flyTo` parameters.
   - Update `src/components/RouteMap.web.tsx` with identical parameters for cross-platform parity.
2. **Phase 2: Static Type & Build Validation**:
   - Run `npm run typecheck` to verify zero TypeScript errors.
3. **Phase 3: Android Expo Go Real-Device Flight Verification**:
   - Launch app from Kraków default center.
   - Tap "Locate Me" to trigger cross-city flight to user's real location.
   - Verify smooth zoom-out $\rightarrow$ flight $\rightarrow$ zoom-in sequence with zero single-frame cuts.
4. **Phase 4: Web Browser Parity Check**:
   - Pan across map to a distant country or city.
   - Tap "Locate Me" and observe 60 FPS smooth bell-curve flight back to local coordinates.

---

### 4.6 Verification & QA Checklist

- [ ] **Long-Distance Flight ($D > 2\text{km}$)**: Camera performs a swift $1.5\text{s}$ flight, pulling back to a high altitude (zoom-out) mid-flight and descending (zoom-in) smoothly into zoom 16 over the user's location.
- [ ] **Short-Distance Recenter ($D < 300\text{m}$)**: Re-centering smoothly glides within $0.8\text{s}$ without unnecessary disorienting zoom out.
- [ ] **Bell-Curve Acceleration**: Speed visibly accelerates smoothly from 0, reaches top speed in the middle, and decelerates gently to a stop.
- [ ] **Rapid Multi-Tap Resilience**: Tapping the button multiple times cleanly restarts flight from the current camera position without flickering or map tearing.
- [ ] **Marker Accuracy**: Live radar marker stays pinned to the target coordinates throughout and after the flight.
