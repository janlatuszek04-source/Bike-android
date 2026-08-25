import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { LatLng } from '../types';
import { theme } from '../theme';

type CommonProps = {
  route: LatLng[];
  initialRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  follow?: boolean;
  showUserDot?: boolean;
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

export function RouteMap(props: CommonProps) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const hasFittedBoundsRef = useRef(false);

  useEffect(() => {
    loadLeaflet(() => {
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
      props.initialRegion?.latitude ??
      (route.length > 0 ? route[route.length - 1].latitude : KRAKOW_DEFAULT.latitude);
    const initialLon =
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

      // User location marker
      if (props.showUserDot && route.length > 0) {
        const lastPoint = route[route.length - 1];
        const userIcon = window.L.divIcon({
          className: 'leaflet-user-marker',
          html: `<div style="
            width: 16px;
            height: 16px;
            background-color: #84CC16;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 8px rgba(0,0,0,0.5), 0 0 12px #84CC16;
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = window.L.marker([lastPoint.latitude, lastPoint.longitude], {
          icon: userIcon,
        }).addTo(map);
        userMarkerRef.current = marker;
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
      };
    } catch (err) {
      console.error('Error initializing Leaflet map:', err);
    }
  }, [leafletReady]);

  // Update Route Polyline and Map Position
  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    const latLngs = route.map((p) => [p.latitude, p.longitude]);
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latLngs);
    }

    if (route.length > 0) {
      const lastPoint = route[route.length - 1];

      // Update or create user marker
      if (props.showUserDot) {
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([lastPoint.latitude, lastPoint.longitude]);
        } else {
          const userIcon = window.L.divIcon({
            className: 'leaflet-user-marker',
            html: `<div style="
              width: 16px;
              height: 16px;
              background-color: #84CC16;
              border: 3px solid #FFFFFF;
              border-radius: 50%;
              box-shadow: 0 0 8px rgba(0,0,0,0.5), 0 0 12px #84CC16;
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          userMarkerRef.current = window.L.marker([lastPoint.latitude, lastPoint.longitude], {
            icon: userIcon,
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
  }, [route, props.follow, props.showUserDot]);

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
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
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

