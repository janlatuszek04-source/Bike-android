# Agent Instructions & Project Context: BikeTracker (Bike-android)

## 1. Core Architectural Reference & Documentation Rules
- For detailed technical architecture, data schemas (`TrackPoint`, `Ride`, `RideSummary`), screen layouts, and logic breakdowns, always refer to:
  `docs/codebaseanalisis.md`
- **Implementation Plans Rule**: When adding new technical problem descriptions or plans to `docs/Implamentation_plans.md`, **ALWAYS append new entries** to the document rather than rewriting or removing previous problem history.

---

## 2. Environment & Dependency Rules
- **Expo SDK & React 19 Alignment**:
  - The project runs on **Expo SDK 57**, **React 19** (`19.2.3`), and **React Native** (`0.86.2`).
  - **Do NOT run `npm audit fix --force`**: This will attempt breaking downgrades across Expo packages, causing severe peer-dependency conflicts with React 19.
  - When adding or upgrading libraries, always verify compatibility with `npx expo install <package>` or run `npx expo install --check`.
- **Package Overrides**:
  - `package.json` maintains overrides for legacy transitive dependencies (`rimraf`, `glob`, `inflight`). Maintain these overrides when resolving dependency conflicts.

---

## 3. Platform & Runtime Constraints
- **Cross-Platform Map Handling**:
  - **Native (iOS/Android)**: Implemented in `src/components/RouteMap.native.tsx` using `react-native-webview` + Leaflet.js with OpenStreetMap raster tiles (zero Google Cloud API keys needed).
  - **Web**: Implemented in `src/components/RouteMap.web.tsx` using Leaflet.js DOM container with OpenStreetMap raster tiles.
  - **Communication**: React Native streams updates via `injectJavaScript` action bridge (`UPDATE_ROUTE`, `UPDATE_USER_LOCATION`, `SET_START_FINISH`).
- **Location & Telemetry Logic**:
  - **GPS Jitter Filtering**: Ignore updates with accuracy > 20m or movement < 3m (`src/utils/geo.ts`).
  - **Android Background Service**: Operates with an active foreground service notification (`app.json`).
  - **Web Testing**: Utilizes simulated GPS movement generator in `src/utils/mockLocation.ts`.

---

## 4. UI & Storage Conventions
- **Theme**: Unified dark theme with lime green accents (`#84CC16`) in `src/theme.ts`.
- **Icons**: Standardized on `lucide-react-native`.
- **Persistence**: Managed through `src/utils/storage.ts` using AsyncStorage key `biketracker.rides.v1`.
