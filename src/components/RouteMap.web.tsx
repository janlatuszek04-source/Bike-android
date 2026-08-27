import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { LatLng } from '../types';
import { theme } from '../theme';

type CommonProps = {
  route: LatLng[];
  initialRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  follow?: boolean;
  showUserDot?: boolean;
  userLocation?: LatLng | null;
  recenterLocation?: LatLng | null;
};

const KRAKOW_DEFAULT: LatLng = { latitude: 50.0647, longitude: 19.9450 };

declare global {
  interface Window {
    L?: any;
  }
}

function loadLeaflet(onLoad: () => void) {
  if (typeof window === 'undefined') return;
  if (window.L) {
    onLoad();
    return;
  }

  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  let script = document.getElementById('leaflet-js') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => onLoad();
    document.head.appendChild(script);
  } else {
    script.addEventListener('load', () => onLoad());
  }
}

function injectMarkerStyles() {
  if (typeof document === 'undefined' || document.getElementById('map-marker-styles')) return;
  const style = document.createElement('style');
  style.id = 'map-marker-styles';
  style.innerHTML = `
    @keyframes live-radar-pulse {
      0% {
        transform: scale(0.6);
        opacity: 0.9;
      }
      70% {
        transform: scale(2.2);
        opacity: 0.15;
      }
      100% {
        transform: scale(2.5);
        opacity: 0;
      }
    }
    .custom-live-marker {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .live-radar-pulse {
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(132, 204, 22, 0.35);
      border: 1.5px solid #84CC16;
      animation: live-radar-pulse 2s infinite ease-out;
      top: -8px;
      left: -8px;
      pointer-events: none;
    }
    .live-core-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #84CC16;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 10px rgba(0,0,0,0.5), 0 0 10px #84CC16;
      z-index: 5;
      position: relative;
    }
    .live-label-pill {
      position: absolute;
      bottom: 22px;
      background: rgba(15, 23, 42, 0.92);
      color: #84CC16;
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 3px 8px;
      border-radius: 8px;
      border: 1px solid #334155;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      white-space: nowrap;
      pointer-events: none;
      letter-spacing: 0.5px;
      z-index: 10;
    }
    .pin-badge-marker {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .pin-start-badge {
      background: #15803D;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 800;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #22C55E;
      box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      white-space: nowrap;
      margin-bottom: 2px;
    }
    .pin-start-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #22C55E;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 0 8px rgba(0,0,0,0.5);
    }
    .pin-finish-badge {
      background: #0F172A;
      color: #F8FAFC;
      font-size: 11px;
      font-weight: 800;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #64748B;
      box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      white-space: nowrap;
      margin-bottom: 2px;
    }
    .pin-finish-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #EF4444;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 0 8px rgba(0,0,0,0.5);
    }
  `;
  document.head.appendChild(style);
}

function createLiveUserIcon() {
  return window.L.divIcon({
    className: 'custom-live-marker-container',
    html: `
      <div class="custom-live-marker">
        <div class="live-label-pill">📍 Current Location</div>
        <div class="live-radar-pulse"></div>
        <div class="live-core-dot"></div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function createStartPinIcon() {
  return window.L.divIcon({
    className: 'custom-start-marker-container',
    html: `
      <div class="pin-badge-marker">
        <div class="pin-start-badge">🚩 START</div>
        <div class="pin-start-dot"></div>
      </div>
    `,
    iconSize: [60, 30],
    iconAnchor: [30, 28],
  });
}

function createFinishPinIcon() {
  return window.L.divIcon({
    className: 'custom-finish-marker-container',
    html: `
      <div class="pin-badge-marker">
        <div class="pin-finish-badge">🏁 FINISH</div>
        <div class="pin-finish-dot"></div>
      </div>
    `,
    iconSize: [60, 30],
    iconAnchor: [30, 28],
  });
}

export function RouteMap(props: CommonProps) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const finishMarkerRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const hasFittedBoundsRef = useRef(false);

  useEffect(() => {
    loadLeaflet(() => {
      injectMarkerStyles();
      setLeafletReady(true);
    });
  }, []);

  const route = props.route;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!leafletReady || !containerRef.current || mapRef.current) return;

    const el = containerRef.current.node || containerRef.current;
    if (!el || !(el instanceof HTMLElement)) return;

    const initialLat =
      props.userLocation?.latitude ??
      props.initialRegion?.latitude ??
      (route.length > 0 ? route[route.length - 1].latitude : KRAKOW_DEFAULT.latitude);
    const initialLon =
      props.userLocation?.longitude ??
      props.initialRegion?.longitude ??
      (route.length > 0 ? route[route.length - 1].longitude : KRAKOW_DEFAULT.longitude);

    try {
      const map = window.L.map(el, {
        center: [initialLat, initialLon],
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
      });

      // Standard colorful OpenStreetMap tiles
      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Add Zoom control to bottom right
      window.L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Route polyline with outline for high contrast on OSM tiles
      const latLngs = route.map((p) => [p.latitude, p.longitude]);
      const polyline = window.L.polyline(latLngs, {
        color: '#65A30D',
        weight: 6,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);

      polylineRef.current = polyline;

      // Live user location marker
      if (props.showUserDot) {
        const markerPos =
          route.length > 0
            ? route[route.length - 1]
            : (props.userLocation ?? { latitude: initialLat, longitude: initialLon });
        const marker = window.L.marker([markerPos.latitude, markerPos.longitude], {
          icon: createLiveUserIcon(),
        }).addTo(map);
        userMarkerRef.current = marker;
      }

      // Historical Ride Detail: Start & Finish markers
      if (!props.showUserDot && route.length > 1) {
        const startPoint = route[0];
        const finishPoint = route[route.length - 1];

        startMarkerRef.current = window.L.marker([startPoint.latitude, startPoint.longitude], {
          icon: createStartPinIcon(),
        }).addTo(map);

        finishMarkerRef.current = window.L.marker([finishPoint.latitude, finishPoint.longitude], {
          icon: createFinishPinIcon(),
        }).addTo(map);
      }

      if (route.length > 1) {
        map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
        hasFittedBoundsRef.current = true;
      }

      mapRef.current = map;
      setMapInitialized(true);

      // Handle container resizing
      const resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(el);

      return () => {
        resizeObserver.disconnect();
        map.remove();
        mapRef.current = null;
        polylineRef.current = null;
        userMarkerRef.current = null;
        startMarkerRef.current = null;
        finishMarkerRef.current = null;
      };
    } catch (err) {
      console.error('Error initializing Leaflet map:', err);
    }
  }, [leafletReady]);

  // Imperative Re-center handler with adaptive bell-curve flight
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
      userMarkerRef.current = window.L.marker(
        targetLatLng,
        { icon: createLiveUserIcon() }
      ).addTo(mapRef.current);
    }
  }, [props.recenterLocation, props.showUserDot]);

  // Update Route Polyline and Map Position
  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    const latLngs = route.map((p) => [p.latitude, p.longitude]);
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latLngs);
    }

    if (props.showUserDot) {
      const currentPos =
        route.length > 0
          ? route[route.length - 1]
          : props.userLocation;
      if (currentPos) {
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([currentPos.latitude, currentPos.longitude]);
        } else {
          userMarkerRef.current = window.L.marker([currentPos.latitude, currentPos.longitude], {
            icon: createLiveUserIcon(),
          }).addTo(mapRef.current);
        }
      }
    }

    if (route.length > 0) {
      const lastPoint = route[route.length - 1];

      // Update Start & Finish markers for detail view
      if (!props.showUserDot && route.length > 1) {
        const startPoint = route[0];
        const finishPoint = route[route.length - 1];

        if (startMarkerRef.current) {
          startMarkerRef.current.setLatLng([startPoint.latitude, startPoint.longitude]);
        } else {
          startMarkerRef.current = window.L.marker([startPoint.latitude, startPoint.longitude], {
            icon: createStartPinIcon(),
          }).addTo(mapRef.current);
        }

        if (finishMarkerRef.current) {
          finishMarkerRef.current.setLatLng([finishPoint.latitude, finishPoint.longitude]);
        } else {
          finishMarkerRef.current = window.L.marker([finishPoint.latitude, finishPoint.longitude], {
            icon: createFinishPinIcon(),
          }).addTo(mapRef.current);
        }
      }

      // Auto-follow during live recording
      if (props.follow) {
        mapRef.current.panTo([lastPoint.latitude, lastPoint.longitude], {
          animate: true,
          duration: 0.5,
        });
      } else if (route.length > 1 && !hasFittedBoundsRef.current && polylineRef.current) {
        mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
        hasFittedBoundsRef.current = true;
      }
    }
  }, [route, props.follow, props.showUserDot, props.userLocation]);

  return (
    <View style={styles.container}>
      <View ref={containerRef} style={styles.mapContainer} />
      {!leafletReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={theme.accent} size="small" />
          <Text style={styles.loadingText}>Loading OpenStreetMap...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.mapTile,
    position: 'relative',
    overflow: 'hidden',
  },
  mapContainer: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: theme.textMuted,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
});

