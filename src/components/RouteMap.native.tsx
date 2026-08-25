import { StyleSheet } from 'react-native';
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: MapView, Polyline } = require('react-native-maps');

export function RouteMap(props: CommonProps) {
  const region =
    props.initialRegion ??
    (props.route.length > 0
      ? {
          latitude: props.route[props.route.length - 1].latitude,
          longitude: props.route[props.route.length - 1].longitude,
          latitudeDelta: deltaFor(props.route),
          longitudeDelta: deltaFor(props.route),
        }
      : { latitude: 50.0647, longitude: 19.9450, latitudeDelta: 0.02, longitudeDelta: 0.02 });

  return (
    <MapView
      style={styles.map}
      initialRegion={region}
      region={props.follow && props.route.length > 0 ? region : undefined}
      showsUserLocation={!!props.showUserDot}
      showsMyLocationButton
      customMapStyle={[
        { elementType: 'geometry', stylers: [{ color: theme.mapTile }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#94A3B8' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: theme.bg }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B1220' }] },
        { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0B1220' }] },
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ]}
    >
      {props.route.length > 1 && (
        <Polyline
          coordinates={props.route}
          strokeColor={theme.accent}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: theme.mapTile },
});
