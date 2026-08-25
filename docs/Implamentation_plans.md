# Technical Problem Descriptions and Implementation Plans

This document provides a comprehensive technical analysis and architectural implementation plan addressing three critical issues in the **BikeTracker** application:
1. **Empty Black Grid Map (Missing Map Tiles)**
2. **Unlabeled Center Location Dot (User Marker Ambiguity)**
3. **Unreadable and Misplaced Speed-to-Distance / Telemetry Graph**

---

## 1. Executive Summary of Issues

| Issue | Manifestation in App | Root Cause | Target Solution |
| :--- | :--- | :--- | :--- |
| **1. Missing Map Content** | Map area renders as pitch-black squares with a faint CSS grid line overlay instead of streets, terrain, or geography. | `src/components/RouteMap.web.tsx` uses a static CSS linear-gradient placeholder instead of fetching real raster/vector map tiles from OpenStreetMap or a map SDK. | Integrate a real interactive tile-layer mapping engine on Web (Leaflet / OpenStreetMap via HTML5/WebView/DOM or MapLibre GL) with dark-mode tile styling, matching the native `react-native-maps` experience. |
| **2. Unlabeled Center Dot** | A static lime-green circle appears in the center of the screen with zero context, tooltip, or label. | `RouteMap` unconditionally renders an unannotated `14x14px` `<View>` at the last track point or default coordinate without start/current state tags, pulse animation, or user badge. | Implement a dedicated `UserLocationMarker` component featuring a pulsing ripple ring, directional heading indicator, and clear context badge ("Current Location" / "Ride Start" / "Finish"). |
| **3. Unreadable & Misplaced Graph** | Speed graph text is overlapping into solid illegible black/white blocks, labeled with raw seconds, and floats awkwardly between metric blocks. | `app/ride/[id].tsx` maps raw GPS coordinates directly to `react-native-gifted-charts` without downsampling, calculates raw seconds instead of distance (km), and lacks axis stride / layout framing. | 1. Calculate cumulative distance (km) on the X-axis.<br>2. Apply LTTB / equidistant downsampling.<br>3. Fix X/Y axis label stride and interval formatting.<br>4. Reorganize layout into an interactive Telemetry Analysis Card with dual mode (Speed vs Distance / Speed vs Time). |

---

## 2. Issue 1: Missing Map Tiles (Black Squares / Grid Pattern)

### 2.1 Technical Root Cause Analysis
In `src/components/RouteMap.web.tsx`, the web implementation is a bare-bones canvas mock:
```tsx
// src/components/RouteMap.web.tsx (Lines 21-26)
const gridStyle = {
  backgroundColor: theme.mapTile, // #0B1220
  backgroundImage:
    'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
};
```
- **No Tile Engine**: No OpenStreetMap tile layer (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) or CartoDB Dark Matter tile layer is fetched.
- **Static Coordinate Projection**: GPS coordinates are linearly mapped into a percentage bounding box (`toX`, `toY`) and drawn on an SVG polyline on top of the dark CSS grid.
- **Misleading Label**: The UI shows `<Text>OpenStreetMap preview</Text>`, but no network requests or tile layers exist.
- **Native Discrepancy**: While `RouteMap.native.tsx` uses `react-native-maps`, on Web (often used for development, preview, and web builds), the user only sees an empty grid.

### 2.2 Proposed Solution & Architecture

#### Strategy A: Leaflet / OpenStreetMap Integration for Web (Recommended)
Embed an interactive OpenStreetMap view using **Leaflet** with CartoDB Dark Matter / Stadia Dark tiles (to preserve the app's dark aesthetic `#0F172A`).

1. **Web Implementation (`src/components/RouteMap.web.tsx`)**:
   - Use an HTML `iframe` / Leaflet bundle or `react-leaflet` / OpenLayers / MapLibre to render real tile layers.
   - For pure React Native Web compatibility without heavy native bridges, use standard Leaflet JS loaded dynamically or via a dedicated Leaflet Web component.
   - Configure OpenStreetMap / CartoDB Dark Matter tiles:
     `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
   - Dynamically pan and zoom (`fitBounds`) as new GPS track points arrive.
   - Draw an SVG/Leaflet `Polyline` with `#84CC16` (theme accent) and 4px width.

2. **Native Implementation Polish (`src/components/RouteMap.native.tsx`)**:
   - Ensure standard Google Maps / Apple Maps tiles render properly with custom dark JSON styling.
   - Handle permissions and fallback gracefully if Google Play Services are unavailable.

```
+-------------------------------------------------------------+
|                      RouteMap Container                     |
|                                                             |
|   +-----------------------------------------------------+   |
|   |  OpenStreetMap / CartoDB Dark Tile Layer             |   |
|   |  (Streets, Rivers, Parks, Topography in Dark Theme) |   |
|   +-----------------------------------------------------+   |
|                              │                              |
|                              ▼                              |
|   +-----------------------------------------------------+   |
|   |  Dynamic Polyline Layer (Lime Green #84CC16)        |   |
|   +-----------------------------------------------------+   |
|                              │                              |
|                              ▼                              |
|   +-----------------------------------------------------+   |
|   |  UserLocationMarker / StartPin / FinishPin          |   |
|   +-----------------------------------------------------+   |
+-------------------------------------------------------------+
```

### 2.3 Step-by-Step Implementation Plan
1. **Create Web Map Helper**: Create a clean Leaflet DOM-based map container in `src/components/RouteMap.web.tsx` using `unpkg.com/leaflet` or native Leaflet CSS/JS.
2. **Apply Tile Provider**: Set TileLayer URL to `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` with attribution `© OpenStreetMap contributors © CARTO`.
3. **Synchronize Route & Bounds**:
   - Update Polyline coordinates whenever `props.route` changes.
   - When `props.follow` is true, center the map on the latest point with smooth panning (`panTo`).
4. **Fallback Handling**: If offline or tiles fail to load, gracefully fall back to vector route rendering with an "Offline Map" indicator.

---

## 3. Issue 2: Unlabeled Center Location Dot

### 3.1 Technical Root Cause Analysis
In `src/components/RouteMap.web.tsx`:
```tsx
// Lines 70-80
{route.length > 0 && (
  <View
    style={[
      styles.dot,
      {
        left: `${toX(route[route.length - 1].longitude)}%`,
        top: `${toY(route[route.length - 1].latitude)}%`,
      },
    ]}
  />
)}
```
- **Zero Identification**: The dot is just a plain `14px` lime green square with `borderRadius: 7`. There is no textual indicator, icon, or label.
- **State Confusion**:
  - In `idle` state before pressing **START**, the map defaults to Berlin (`52.52, 13.405`) or initial location. The dot sits dead-center without telling the user "Current GPS Location" or "Ready to Record".
  - In `recording` state, the user cannot tell if it represents the starting point, current head of the track, or a waypoint.
  - On the **Ride Detail** screen (`app/ride/[id].tsx`), only the last coordinate has a dot; the start coordinate is missing completely.

### 3.2 Proposed Solution & Architecture

#### 1. Context-Aware Location Marker Component (`src/components/LocationMarker.tsx`)
Create a dedicated marker component with three distinct visual states:

```
[ Idle / Live GPS ]                [ Ride Detail: Start ]           [ Ride Detail: Finish ]
    ( ( 🔘 ) )                           🚩 START                          🏁 FINISH
  +---------------+                     +---------+                       +----------+
  | Current Pos   |                     | 0.00 km |                       | 14.82 km |
  +---------------+                     +---------+                       +----------+
```

- **Live Tracker Mode (`app/(tabs)/index.tsx`)**:
  - **Pulsing Halo Ring**: Animated CSS/Reanimated radar pulse showing active GPS signal lock.
  - **High-Contrast Center**: White core with lime border (`#84CC16`).
  - **Floating Badge**: Small pill tag displaying `"Current Position"` or `"Live GPS"` with instantaneous speed readout.
- **Historical Ride Detail Mode (`app/ride/[id].tsx`)**:
  - **Green Start Pin (A)**: Tagged `"Start"` at `route[0]`.
  - **Red/Checker Finish Pin (B)**: Tagged `"Finish"` at `route[route.length - 1]`.

### 3.3 Step-by-Step Implementation Plan
1. **Design `LocationMarker` Component**:
   - Props: `type: 'live' | 'start' | 'end'`, `coordinate: LatLng`, `title?: string`, `speedKmh?: number`.
   - Include radar pulse animation (`@keyframes pulse` on web, `Animated.loop` on native).
2. **Update `RouteMap.web.tsx` & `RouteMap.native.tsx`**:
   - In Live Mode (`showUserDot={true}`), render the pulsing `LocationMarker` at the latest track point with a `"Current Location"` label.
   - In Detail Mode, render both **Start Marker** (green badge with flag icon) and **Finish Marker** (red/lime badge with checkered flag).
3. **Empty / Pre-start State Indicator**:
   - When idle and awaiting GPS fix, display a banner: `"Waiting for GPS signal..."` instead of a mysterious static dot in Berlin.

---

## 4. Issue 3: Unreadable & Misplaced Speed-to-Distance Graph

### 4.1 Technical Root Cause Analysis

#### A. Overlapping / Colliding Labels
In `app/ride/[id].tsx`:
```tsx
// Lines 31-38
const chartData = useMemo(() => {
  if (!ride || ride.track.length === 0) return [];
  const start = ride.track[0].timestamp;
  return ride.track.map((p) => ({
    value: Number(p.speedKmh.toFixed(1)),
    label: `${Math.floor((p.timestamp - start) / 1000)}s`, // Raw seconds for every single point!
  }));
}, [ride]);
```
- A 30-minute ride recorded every 2 seconds creates **900 data points**.
- The code creates 900 X-axis labels (`"0s"`, `"2s"`, `"4s"`, ..., `"1800s"`).
- `react-native-gifted-charts` tries to render all 900 text labels in a 300px width container, resulting in hundreds of overlapping characters creating an unreadable solid black smear across the screen.

#### B. Wrong Metric on X-Axis (Seconds instead of Distance)
- The user requested and expected a **Speed vs Distance** graph (the cycling standard).
- The current implementation plots raw timestamp seconds (`${s}s`) rather than cumulative distance in kilometers (`0.0 km`, `2.5 km`, `5.0 km`, etc.).

#### C. Unbounded Chart Sizing & Poor Visual Placement
- In `app/ride/[id].tsx`, `LineChart` is rendered with `height={180}` inside a generic `chartCard` wedged between the summary cards and the detailed breakdown list:
```
+------------------------------------+
|  Top Bar (Date, Time, Back Arrow)  |
+------------------------------------+
|  Route Map (240px)                 |
+------------------------------------+
|  Metric Cards: Distance & Moving   |
+------------------------------------+
|  Metric Cards: Average & Peak      |
+------------------------------------+
|  [Chart Card: Unreadable Smear]    | <--- Awkward, unformatted, cramped
+------------------------------------+
|  Stat Lines List                   |
+------------------------------------+
```
- No horizontal scrolling, no responsive parent width calculation, no interactive point tooltips, and no legend explaining axis intervals.

### 4.2 Proposed Solution & Architecture

#### 1. Distance-Based Telemetry Calculation
Calculate cumulative distance at each track point using the Haversine formula:
```ts
function computeDistanceChartData(track: TrackPoint[], targetBuckets = 30) {
  if (track.length === 0) return [];
  
  let cumulativeMeters = 0;
  const pointsWithDistance: { distanceKm: number; speedKmh: number }[] = [];
  
  for (let i = 0; i < track.length; i++) {
    if (i > 0) {
      cumulativeMeters += haversineMeters(track[i - 1], track[i]);
    }
    pointsWithDistance.push({
      distanceKm: cumulativeMeters / 1000,
      speedKmh: track[i].speedKmh,
    });
  }
  
  // Downsample to targetBuckets (e.g. 20-30 clean points)
  return downsampleTelemetry(pointsWithDistance, targetBuckets);
}
```

#### 2. Downsampling & Label Stride Algorithm (LTTB / Even Sampling)
- Downsample 500+ raw GPS coordinates into **25–35 clean display points**.
- Apply moving average smoothing (window size = 3) to eliminate GPS speed jitter.
- Only show X-axis labels at clean, evenly spaced intervals (e.g., every 1 km, 2 km, or 5 km):
```ts
// Example formatted labels:
// Point 0  -> label: "0 km",  showXAxisIndex: true
// Point 5  -> label: "",      showXAxisIndex: false
// Point 10 -> label: "2.5 km", showXAxisIndex: true
```

#### 3. Redesigned Telemetry Card UI & Layout
Reorder the Ride Detail screen for clear visual hierarchy:
1. **Hero Route Map** (with Start/Finish badges and route path)
2. **Key Metric Summary Grid** (Distance, Total Time, Avg Speed, Max Speed)
3. **Dedicated Telemetry Analysis Section**:
   - **Mode Switcher Toggle**: `[ Speed vs Distance ]` | `[ Speed vs Time ]`
   - **Summary Sub-header**: Average line reference, Peak speed marker callout.
   - **Interactive Line Chart**:
     - Clean Y-axis: `0`, `10`, `20`, `30`, `40` km/h with horizontal dotted grid lines.
     - Clean X-axis: `0 km`, `1.0 km`, `2.0 km`, `3.0 km` (or `00:00`, `05:00`, `10:00`).
     - Interactive tooltip on tap displaying: `Speed: 24.3 km/h · Dist: 1.8 km`.
4. **Chronological Splits / Segment Details**

```
+─────────────────────────────────────────────────────────────+
|                     SPEED PROFILE                           |
|  [ Speed vs Distance ] (active)    [ Speed vs Time ]        |
|                                                             |
|  km/h                                                       |
|   40 ┼ - - - - - - - - - - - - - - - - - - - - (Peak: 38.2) |
|   30 ┼           ╭────────╮                                 |
|   20 ┼───────────╯        ╰──────╮        ╭──────── (Avg: 21.4)
|   10 ┼                            ╰───────╯                 |
|    0 ┴──────────┬──────────┬──────────┬──────────┬────────  |
|               0.0 km     1.0 km     2.0 km     3.0 km       |
+─────────────────────────────────────────────────────────────+
```

### 4.3 Step-by-Step Implementation Plan
1. **Implement `src/utils/telemetry.ts`**:
   - `buildSpeedDistanceSeries(track, maxPoints)`: Computes cumulative distance, applies smoothing, and generates clean X-axis step labels.
   - `buildSpeedTimeSeries(track, maxPoints)`: Generates clean elapsed time step labels (`mm:ss`).
2. **Configure `react-native-gifted-charts` Parameters in `app/ride/[id].tsx`**:
   - Set `initialSpacing={10}`, `endSpacing={10}`, `spacing={width / points.length}`.
   - Set `yAxisLabelSuffix=" km/h"`, `yAxisTextStyle`, `xAxisLabelTextStyle` with explicit margins.
   - Set `stepValue` and `maxValue` dynamically based on `Math.ceil(ride.maxSpeed / 10) * 10`.
   - Add `showDataPointsForMissingValues={false}` and `curved={true}` for clean curves.
3. **Add Segment Toggle**:
   - Add state `[chartMetric, setChartMetric] = useState<'distance' | 'time'>('distance')`.
   - Render segmented control button group above the chart.
4. **Interactive Scrubbing / Tooltips**:
   - Enable `pointerConfig` in `LineChart` to show pointer strip, coordinate dot, and floating tooltip on touch.

---

## 5. File Modifications & Architecture Map

```
Bike-android/
├── src/
│   ├── components/
│   │   ├── RouteMap.web.tsx         [MODIFIED] -> Real Leaflet / CartoDB Dark tile layer & bounds
│   │   ├── RouteMap.native.tsx      [MODIFIED] -> Start/Finish markers & custom dark map styles
│   │   ├── RouteMap.d.ts            [MODIFIED] -> Updated props (markers, follow, interactive)
│   │   └── LocationMarker.tsx       [NEW]      -> Pulsing radar GPS indicator & text label
│   ├── utils/
│   │   ├── telemetry.ts             [NEW]      -> Downsampling, distance series, smoothing
│   │   └── geo.ts                   [MODIFIED] -> Haversine cumulative distance helpers
│   └── theme.ts                     [MODIFIED] -> Added chart grid & marker color tokens
├── app/
│   ├── (tabs)/
│   │   └── index.tsx                [MODIFIED] -> Live GPS status badge, labeled position indicator
│   └── ride/
│       └── [id].tsx                 [MODIFIED] -> Reorganized layout, Speed vs Distance chart
└── docs/
    ├── codebaseanalisis.md          [REFERENCE]
    └── Implamentation_plans.md      [THIS FILE]
```

---

## 6. Verification and Validation Checklist

- [ ] **Web Map Tiles**: Opening `http://localhost:8081` on Web displays genuine map streets and terrain (CartoDB Dark / OSM) instead of an empty black grid.
- [ ] **Active Tracking Marker**: A clear pulsing marker labeled `"Current Location"` is visible and tracks simulated/real GPS points smoothly.
- [ ] **Start & Finish Pins**: Completed rides show a green `"Start"` badge at origin and a checkered `"Finish"` badge at destination.
- [ ] **Speed vs Distance Graph**:
  - X-axis clearly displays distance in kilometers (`0 km`, `1.5 km`, `3.0 km`...).
  - Text labels do not overlap or collide.
  - Data points are smoothly curved and downsampled.
  - Tapping or scrubbing shows exact telemetry at that distance.
- [ ] **Visual Layout**: Graph is housed in a clean, dedicated card with metric toggle controls and proper padding.
