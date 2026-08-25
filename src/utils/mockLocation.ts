import { Platform } from 'react-native';

type MockFn = () => void;

type MockSubscriber = (loc: {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
  speed: number | null;
}) => void;

const MOCK_BASE = { latitude: 50.0647, longitude: 19.9450 };

export function createMockLocationWatcher(onPoint: MockSubscriber): MockFn {
  let active = true;
  let t = 0;
  let dist = 0;

  const interval = setInterval(() => {
    if (!active) return;
    t += 1;
    const bearing = (t * 7) % 360;
    const stepMeters = 9 + Math.random() * 4;
    dist += stepMeters;
    const lat = MOCK_BASE.latitude + (dist / 111320) * Math.cos((bearing * Math.PI) / 180);
    const lon =
      MOCK_BASE.longitude +
      (dist / (111320 * Math.cos((MOCK_BASE.latitude * Math.PI) / 180))) *
        Math.sin((bearing * Math.PI) / 180);
    onPoint({
      latitude: lat,
      longitude: lon,
      altitude: 40 + Math.sin(t / 10) * 2,
      accuracy: 4 + Math.random() * 3,
      timestamp: Date.now(),
      speed: (stepMeters / 3) * (1 + Math.random() * 0.2),
    });
  }, 1200);

  return () => {
    active = false;
    clearInterval(interval);
  };
}

export const shouldUseMockLocation = Platform.OS === 'web';
