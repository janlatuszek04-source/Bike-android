import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Ride, RideSummary } from '../types';

const RIDES_KEY = 'biketracker.rides.v1';

export async function loadRides(): Promise<RideSummary[]> {
  const raw = await AsyncStorage.getItem(RIDES_KEY);
  if (!raw) return [];
  const all = JSON.parse(raw) as Ride[];
  return all
    .map(({ track: _track, ...rest }) => rest)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export async function loadRide(id: string): Promise<Ride | null> {
  const raw = await AsyncStorage.getItem(RIDES_KEY);
  if (!raw) return null;
  const all = JSON.parse(raw) as Ride[];
  return all.find((r) => r.id === id) ?? null;
}

export async function saveRide(ride: Ride): Promise<void> {
  const raw = await AsyncStorage.getItem(RIDES_KEY);
  const all: Ride[] = raw ? JSON.parse(raw) : [];
  all.push(ride);
  await AsyncStorage.setItem(RIDES_KEY, JSON.stringify(all));
}

export async function deleteRide(id: string): Promise<void> {
  const raw = await AsyncStorage.getItem(RIDES_KEY);
  if (!raw) return;
  const all: Ride[] = JSON.parse(raw);
  const next = all.filter((r) => r.id !== id);
  await AsyncStorage.setItem(RIDES_KEY, JSON.stringify(next));
}

export function makeRideId(): string {
  return `ride_${Date.now()}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
