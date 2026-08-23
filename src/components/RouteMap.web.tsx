import { StyleSheet, Text, View } from 'react-native';
import type { LatLng } from '../types';
import { theme } from '../theme';

type CommonProps = {
  route: LatLng[];
  initialRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  follow?: boolean;
  showUserDot?: boolean;
};

function deltaFor(route: LatLng[]): number {
  if (route.length === 0) return 0.02;
  const lats = route.map((p) => p.latitude);
  const lons = route.map((p) => p.longitude);
  const latD = Math.max(...lats) - Math.min(...lats);
  const lonD = Math.max(...lons) - Math.min(...lons);
  return Math.max(latD, lonD, 0.005) * 1.6;
}

const gridStyle = {
  backgroundColor: theme.mapTile,
  backgroundImage:
    'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
};

export function RouteMap(props: CommonProps) {
  const route = props.route;
  const region =
    props.initialRegion ??
    (route.length > 0
      ? {
          latitude: route[route.length - 1].latitude,
          longitude: route[route.length - 1].longitude,
          latitudeDelta: deltaFor(route),
          longitudeDelta: deltaFor(route),
        }
      : { latitude: 52.52, longitude: 13.405, latitudeDelta: 0.02, longitudeDelta: 0.02 });

  const d = deltaFor(route);

  const minLat = Math.min(...route.map((p) => p.latitude), region.latitude - d);
  const maxLat = Math.max(...route.map((p) => p.latitude), region.latitude + d);
  const minLon = Math.min(...route.map((p) => p.longitude), region.longitude - d);
  const maxLon = Math.max(...route.map((p) => p.longitude), region.longitude + d);
  const spanLat = maxLat - minLat || 0.01;
  const spanLon = maxLon - minLon || 0.01;

  const toX = (lon: number) => ((lon - minLon) / spanLon) * 100;
  const toY = (lat: number) => 100 - ((lat - minLat) / spanLat) * 100;

  const path =
    route.length > 1
      ? route
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.longitude).toFixed(2)} ${toY(p.latitude).toFixed(2)}`)
          .join(' ')
      : '';

  return (
    <View style={styles.mock}>
      <View style={[styles.gridBase, gridStyle as unknown as object]} />
      {path ? (
        <View style={styles.svgWrap}>
          <svg width="100%" height="100%" preserveAspectRatio="none" style={styles.svg}>
            <path d={path} fill="none" stroke={theme.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </View>
      ) : null}
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
      <View style={styles.labelWrap}>
        <Text style={styles.label}>OpenStreetMap preview</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mock: {
    flex: 1,
    backgroundColor: theme.mapTile,
    overflow: 'hidden',
    position: 'relative',
  },
  gridBase: {
    ...StyleSheet.absoluteFillObject,
  },
  svgWrap: { ...StyleSheet.absoluteFillObject, padding: 6 },
  svg: { width: '100%', height: '100%' },
  dot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.accent,
    marginLeft: -7,
    marginTop: -7,
    shadowColor: theme.accent,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  labelWrap: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: 6,
  },
  label: { color: theme.textMuted, fontSize: 11, fontFamily: 'Inter-Regular' },
});
