# Codebase Analysis: Bike-android (BikeTracker)

This document provides a comprehensive technical overview and architecture reference for the **Bike-android** (BikeTracker) repository.

---

## 1. Project Overview & Purpose

**BikeTracker** is a cross-platform mobile and web application built with **React Native**, **Expo SDK 57**, and **TypeScript**. It functions as a digital bicycle computer and ride tracking app that records cycling sessions, plots real-time GPS routes, displays telemetry data (speed, elapsed moving time, distance, averages, and maximums), and provides historical review with interactive speed charts.

---

## 2. Tech Stack & Dependencies

- **Framework**: React Native `0.86.3`, Expo SDK `^57.0.17`
- **Navigation & Routing**: `expo-router` `~6.0.8` (file-based routing with typed routes enabled)
- **Language**: TypeScript `~6.0.3`
- **Local Persistence**: `@react-native-async-storage/async-storage` `2.2.0`
- **Mapping**:
  - Native (iOS/Android): `react-native-webview` hosting Leaflet.js with OpenStreetMap raster tiles
  - Web: Leaflet.js with OpenStreetMap raster tiles
- **Data Visualization / Charts**: `react-native-gifted-charts` `^1.4.78`, `react-native-svg` `15.12.1`
- **Icons & Styling**: `lucide-react-native` `^0.544.0`, `@expo-google-fonts/inter`
- **Location**: `expo-location` `~57.0.14`
- **Background configuration**: Android location permissions and foreground-service notification settings are declared in `app.json`; the current recorder uses foreground location watching rather than a registered Expo background task.

---

## 3. Architecture & Directory Structure

```
Bike-android/
├── app/                           # Expo Router file-based route definitions
│   ├── (tabs)/
│   │   ├── _layout.tsx            # Bottom tab navigator configuration
│   │   ├── index.tsx              # "Record Ride" live tracker screen
│   │   └── history.tsx            # "Ride History" overview & management screen
│   ├── ride/
│   │   └── [id].tsx               # Detailed individual ride view with charts
│   ├── +not-found.tsx             # Fallback route for undefined paths
│   └── _layout.tsx                # Root layout: font loading & splash screen control
├── src/
│   ├── components/
│   │   ├── ConfirmModal.tsx       # Reusable modal for ride stop/save confirmations
│   │   ├── MetricCard.tsx         # Metric display box (value, unit, label)
│   │   ├── RouteMap.d.ts          # TypeScript declaration for platform-split RouteMap
│   │   ├── RouteMap.native.tsx    # Native WebView hosting Leaflet with route and location markers
│   │   └── RouteMap.web.tsx       # Web Leaflet map with route and location markers
│   ├── hooks/
│   │   └── useRideRecorder.ts     # Core hook managing ride recording state & GPS stream
│   ├── utils/
│   │   ├── geo.ts                 # Haversine distance calculations and formatting utilities
│   │   ├── locationService.ts     # expo-location permission and subscription wrappers
│   │   ├── mockLocation.ts        # Simulated GPS coordinate generator for Web testing
│   │   └── storage.ts             # AsyncStorage CRUD helper methods for Ride objects
│   ├── theme.ts                   # Unified color palette (dark theme with lime accents)
│   └── types.ts                   # Core TypeScript type definitions
├── assets/                        # Static assets (app icons, favicon)
├── docs/                          # Project documentation
├── app.json                       # Expo configuration (permissions, Android foreground service)
├── package.json                   # Project dependencies and run scripts
└── tsconfig.json                  # TypeScript compiler options
```

---

## 4. Key Data Models (`src/types.ts`)

- **`LatLng`**: `{ latitude: number; longitude: number; }`
- **`TrackPoint`**:
  ```ts
  type TrackPoint = {
    latitude: number;
    longitude: number;
    altitude: number | null;
    timestamp: number;
    speedKmh: number;
    accuracy: number | null;
  };
  ```
- **`Ride`**: Full ride entity stored in AsyncStorage.
  ```ts
  type Ride = {
    id: string;
    startedAt: number;
    endedAt: number;
    distanceKm: number;
    movingTimeSec: number;
    avgSpeed: number;
    maxSpeed: number;
    track: TrackPoint[];
  };
  ```
- **`RideSummary`**: `Omit<Ride, 'track'>` (used for lighter list rendering).
- **`RecordingState`**: `'idle' | 'recording' | 'paused'`

---

## 5. Module Breakdown & Logic Flow

### A. Live Tracking Engine (`src/hooks/useRideRecorder.ts`)
- Manages recording lifecycle: `start()`, `pause()`, `resume()`, `stop()`, `finalizeStats()`, `reset()`.
- On web, it uses `createMockLocationWatcher()` to simulate GPS movement. On native platforms, it requests foreground location permission and subscribes with `Location.watchPositionAsync()`.
- **GPS Jitter Filtering**:
  - Ignores location updates where accuracy exceeds `ACCURACY_THRESHOLD_M = 20` meters.
  - Ignores movements shorter than `MIN_MOVEMENT_M = 3` meters calculated via the Haversine formula (`src/utils/geo.ts`).
- **Telemetry Calculation**: Continuously updates instantaneous speed (km/h), moving duration timer, total distance (km), average speed, and maximum recorded speed.
- The moving-time timer advances while the recorder is in the `recording` state and stops while paused.
- The current implementation does not register an Expo background task with `Location.startLocationUpdatesAsync()`. The declared Android foreground-service configuration does not by itself provide full tracking after the app process is terminated.

### B. Route Mapping (`src/components/RouteMap.*`)
- Native mapping is implemented with `react-native-webview`, hosting Leaflet.js and OpenStreetMap raster tiles. The WebView receives route, user-location, start/finish, and recenter commands through a JavaScript bridge.
- Web mapping uses Leaflet.js with OpenStreetMap raster tiles.
- Both implementations support the dark application theme, lime route styling, current-location indicators, and start/finish markers where applicable.

### C. Screens (`app/`)
1. **Live Recording Screen (`app/(tabs)/index.tsx`)**:
   - Live map view on top, primary speed gauge (large numerical display) and metrics grid below.
   - Start, Pause, Resume, and Stop/Save buttons with `ConfirmModal`.
   - Minimum threshold verification (at least 2 points and > 0.01 km) before saving.
   - A locate/recenter control uses the latest recorded point or the current preview location.
2. **History Screen (`app/(tabs)/history.tsx`)**:
   - Total statistics header (total rides count, cumulative distance, total moving time).
   - FlatList of rides with pull-to-refresh and swipeable/clickable delete action.
   - Navigates to individual ride detail on card tap.
3. **Ride Detail Screen (`app/ride/[id].tsx`)**:
   - Static full-route map rendering.
   - Metric summary cards (Distance, Moving time, Average speed, Peak speed).
   - Interactive Speed-vs-Time chart using `react-native-gifted-charts`.
   - Chronological breakdown (start time, end time).

### D. Data Storage (`src/utils/storage.ts`)
- Uses `@react-native-async-storage/async-storage` under the storage key `biketracker.rides.v1`.
- Methods: `loadRides()`, `loadRide(id)`, `saveRide(ride)`, `deleteRide(id)`, `makeRideId()`.
- History lists load summaries without track data; the detailed ride screen loads the complete ride when opened.
- Storage currently assumes valid JSON matching the `Ride` shape and does not perform runtime schema validation.

---

## 6. Permissions & Background Modes (`app.json`)

- **Android**:
  - Permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `WAKE_LOCK`.
  - Foreground Service: Notification configured with title *"BikeTracker is recording your ride"* and accent color `#84CC16`.
  - These settings declare the required Android permissions and notification metadata, but the current recorder still uses `watchPositionAsync()` and does not include a registered Expo background location task.
- **iOS**:
  - Permissions: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`.
  - Background Modes: `["location", "fetch"]`.
