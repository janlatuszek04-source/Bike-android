import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
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

function generateLeafletHtml(initialLat: number, initialLon: number): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #0B1220;
      overflow: hidden;
      touch-action: pan-x pan-y;
    }
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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map, polyline, userMarker, startMarker, finishMarker;
    var hasFittedBounds = false;

    function initMap() {
      try {
        map = L.map('map', {
          center: [${initialLat}, ${initialLon}],
          zoom: 14,
          zoomControl: false,
          attributionControl: false
        });

        // OpenStreetMap standard raster tiles
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        // Lime green route polyline matching theme
        polyline = L.polyline([], {
          color: '#65A30D',
          weight: 6,
          opacity: 0.95,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);

        window.handleNativeAction = function(action) {
          if (!action || !action.type) return;
          var p = action.payload;

          if (action.type === 'UPDATE_ROUTE') {
            polyline.setLatLngs(p.latLngs);
            if (p.fitBounds && p.latLngs.length > 1 && !hasFittedBounds) {
              map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
              hasFittedBounds = true;
            }
          } else if (action.type === 'UPDATE_USER_LOCATION') {
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
            if (p.follow) {
              map.panTo([p.lat, p.lon], { animate: true, duration: 0.5 });
            }
          } else if (action.type === 'SET_START_FINISH') {
            if (startMarker) map.removeLayer(startMarker);
            if (finishMarker) map.removeLayer(finishMarker);

            var startIcon = L.divIcon({
              className: 'custom-start-marker-container',
              html: '<div class="pin-badge-marker"><div class="pin-start-badge">🚩 START</div><div class="pin-start-dot"></div></div>',
              iconSize: [60, 30],
              iconAnchor: [30, 28]
            });
            var finishIcon = L.divIcon({
              className: 'custom-finish-marker-container',
              html: '<div class="pin-badge-marker"><div class="pin-finish-badge">🏁 FINISH</div><div class="pin-finish-dot"></div></div>',
              iconSize: [60, 30],
              iconAnchor: [30, 28]
            });

            startMarker = L.marker([p.start.lat, p.start.lon], { icon: startIcon }).addTo(map);
            finishMarker = L.marker([p.finish.lat, p.finish.lon], { icon: finishIcon }).addTo(map);
          } else if (action.type === 'RECENTER_ON_LOCATION') {
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
        };

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
        }
      } catch (err) {
        console.error('Error initializing Leaflet:', err);
      }
    }

    window.addEventListener('load', initMap);
  </script>
</body>
</html>
`;
}

export function RouteMap(props: CommonProps) {
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const route = props.route;

  const initialCoords = useMemo(() => {
    const lat =
      props.userLocation?.latitude ??
      props.initialRegion?.latitude ??
      (route.length > 0 ? route[route.length - 1].latitude : KRAKOW_DEFAULT.latitude);
    const lon =
      props.userLocation?.longitude ??
      props.initialRegion?.longitude ??
      (route.length > 0 ? route[route.length - 1].longitude : KRAKOW_DEFAULT.longitude);
    return { lat, lon };
  }, []);

  const htmlSource = useMemo(
    () => ({ html: generateLeafletHtml(initialCoords.lat, initialCoords.lon) }),
    [initialCoords.lat, initialCoords.lon]
  );

  const sendAction = (type: string, payload: any) => {
    if (!mapReady || !webViewRef.current) return;
    const js = `if(window.handleNativeAction){ window.handleNativeAction(${JSON.stringify({ type, payload })}); } true;`;
    webViewRef.current.injectJavaScript(js);
  };

  // Re-center action triggered imperatively
  useEffect(() => {
    if (!mapReady || !props.recenterLocation) return;
    sendAction('RECENTER_ON_LOCATION', {
      lat: props.recenterLocation.latitude,
      lon: props.recenterLocation.longitude,
    });
  }, [props.recenterLocation, mapReady]);

  // Synchronize Route & Markers when map is ready or props change
  useEffect(() => {
    if (!mapReady) return;

    const latLngs = route.map((p) => [p.latitude, p.longitude]);
    sendAction('UPDATE_ROUTE', {
      latLngs,
      fitBounds: !props.showUserDot && route.length > 1,
    });

    if (props.showUserDot) {
      const currentPos =
        route.length > 0
          ? route[route.length - 1]
          : (props.userLocation ?? { latitude: initialCoords.lat, longitude: initialCoords.lon });
      sendAction('UPDATE_USER_LOCATION', {
        lat: currentPos.latitude,
        lon: currentPos.longitude,
        follow: !!props.follow,
      });
    }

    if (!props.showUserDot && route.length > 1) {
      sendAction('SET_START_FINISH', {
        start: { lat: route[0].latitude, lon: route[0].longitude },
        finish: { lat: route[route.length - 1].latitude, lon: route[route.length - 1].longitude },
      });
    }
  }, [route, props.follow, props.showUserDot, props.userLocation, mapReady]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={htmlSource}
        style={styles.webView}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        overScrollMode="never"
        scalesPageToFit={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'MAP_READY') {
              setMapReady(true);
            }
          } catch (e) {
            console.error('Error parsing map message:', e);
          }
        }}
      />
      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={theme.accent} size="small" />
          <Text style={styles.loadingText}>Loading Map...</Text>
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
  webView: {
    flex: 1,
    backgroundColor: theme.mapTile,
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
