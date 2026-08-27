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

export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve({ latitude: 50.0647, longitude: 19.9450 }),
          { timeout: 5000, enableHighAccuracy: true }
        );
      } else {
        resolve({ latitude: 50.0647, longitude: 19.9450 });
      }
    });
  }

  const granted = await ensureLocationPermission();
  if (!granted) return null;

  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  } catch (err) {
    console.warn('Could not fetch current position:', err);
    return null;
  }
}

export { ensureBackgroundPermission as ensureBackground };
