# Codebase Analysis: Bike-android (BikeTracker)

This document provides a comprehensive technical overview and architecture reference for the **Bike-android** (BikeTracker) repository.

---

## 1. Project Overview & Purpose

**BikeTracker** is a cross-platform mobile and web application built with **React Native**, **Expo (SDK 54)**, and **TypeScript**. It functions as a digital bicycle computer and ride tracking app that records cycling sessions, plots real-time GPS routes, displays telemetry data (speed, elapsed moving time, distance, averages, and maximums), and provides historical review with interactive speed charts.

---

## 2. Tech Stack & Dependencies

- **Framework**: React Native `0.81.4`, Expo SDK `^54.0.10`
- **Navigation & Routing**: `expo-router` `~6.0.8` (file-based routing with typed routes enabled)
- **Language**: TypeScript `~5.9.2`
- **Local Persistence**: `@react-native-async-storage/async-storage` `2.2.0`
- **Mapping**:
  - Native (iOS/Android): `react-native-maps` `1.20.1`
  - Web: SVG path rendering fallback
- **Data Visualization / Charts**: `react-native-gifted-charts` `^1.4.78`, `react-native-svg` `15.12.1`
- **Icons & Styling**: `lucide-react-native` `^0.544.0`, `@expo-google-fonts/inter`
- **Location & Background Services**: `expo-location` `~19.0.8` (configured with Android foreground service & notifications)

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
│   │   ├── RouteMap.native.tsx    # Native MapView with dark map styling & polyline
│   │   └── RouteMap.web.tsx       # Web SVG/canvas map simulator with grid & path
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
- **GPS Jitter Filtering**:
  - Ignores location updates where accuracy exceeds `ACCURACY_THRESHOLD_M = 20` meters.
  - Ignores movements shorter than `MIN_MOVEMENT_M = 3` meters calculated via the Haversine formula (`src/utils/geo.ts`).
- **Telemetry Calculation**: Continuously updates instantaneous speed (km/h), moving duration timer, total distance (km), average speed, and maximum recorded speed.

### B. Route Mapping (`src/components/RouteMap.*`)
- **Native (`RouteMap.native.tsx`)**: Uses `react-native-maps` `MapView` and `Polyline` with custom dark styling, dynamic delta calculation based on bounding boxes, and active location tracking (`follow`).
- **Web (`RouteMap.web.tsx`)**: Computes SVG coordinates relative to the track's bounding box and renders an SVG polyline on a grid background.

### C. Screens (`app/`)
1. **Live Recording Screen (`app/(tabs)/index.tsx`)**:
   - Live map view on top, primary speed gauge (large numerical display) and metrics grid below.
   - Start, Pause, Resume, and Stop/Save buttons with `ConfirmModal`.
   - Minimum threshold verification (at least 2 points and > 0.01 km) before saving.
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

---

## 6. Permissions & Background Modes (`app.json`)

- **Android**:
  - Permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `WAKE_LOCK`.
  - Foreground Service: Notification configured with title *"BikeTracker is recording your ride"* and accent color `#84CC16`.
- **iOS**:
  - Permissions: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`.
  - Background Modes: `["location", "fetch"]`.
