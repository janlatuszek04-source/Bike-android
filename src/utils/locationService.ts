import { Platform } from 'react-native';
import * as Location from 'expo-location';

type Loc = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
  speed: number | null;
};

type Subscriber = (loc: Loc) => void;
type Removable = { remove: () => void };

export async function ensureLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function ensureBackgroundPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function startLocationTracking(onPoint: Subscriber): Promise<Removable> {
  if (Platform.OS === 'web') {
    const { createMockLocationWatcher } = await import('./mockLocation');
    const stop = createMockLocationWatcher(onPoint);
    return { remove: stop };
  }

  const granted = await ensureLocationPermission();
  if (!granted) throw new Error('Location permission not granted');

  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 2000,
      distanceInterval: 5,
    },
    (loc) => {
      const c = loc.coords;
      onPoint({
        latitude: c.latitude,
        longitude: c.longitude,
        altitude: c.altitude,
        accuracy: c.accuracy,
        timestamp: loc.timestamp,
        speed: c.speed,
      });
    },
  );
  return sub as unknown as Removable;
}

export { ensureBackgroundPermission as ensureBackground };
