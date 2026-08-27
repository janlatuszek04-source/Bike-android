import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { LatLng, RecordingState, TrackPoint } from '../types';
import { haversineMeters } from '../utils/geo';
import { createMockLocationWatcher } from '../utils/mockLocation';
import { getCurrentLocation } from '../utils/locationService';

const ACCURACY_THRESHOLD_M = 20;
const MIN_MOVEMENT_M = 3;
const MS_TO_KMH = 3.6;

type Subscription = { remove: () => void } | null;

export type RecordingStats = {
  state: RecordingState;
  currentSpeed: number;
  distanceKm: number;
  movingTimeSec: number;
  avgSpeed: number;
  maxSpeed: number;
  track: TrackPoint[];
  lastPoint: TrackPoint | null;
  previewLocation: LatLng | null;
  isLocating: boolean;
  error: string | null;
};

export function useRideRecorder() {
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [movingTimeSec, setMovingTimeSec] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [previewLocation, setPreviewLocation] = useState<LatLng | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const subRef = useRef<Subscription>(null);
  const startRef = useRef<number>(0);
  const accumulatedMovingRef = useRef<number>(0);
  const lastMoveRef = useRef<number>(0);
  const distanceRef = useRef<number>(0);
  const maxSpeedRef = useRef<number>(0);
  const trackRef = useRef<TrackPoint[]>([]);
  const lastPointRef = useRef<TrackPoint | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<RecordingState>('idle');

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const pushPoint = useCallback((p: TrackPoint) => {
    if (stateRef.current !== 'recording') return;
    if (p.accuracy != null && p.accuracy > ACCURACY_THRESHOLD_M) return;

    const prev = lastPointRef.current;
    let added = false;
    if (prev) {
      const d = haversineMeters(prev, p);
      if (d >= MIN_MOVEMENT_M) {
        distanceRef.current += d;
        added = true;
      }
    } else {
      added = true;
    }

    if (added) {
      trackRef.current = [...trackRef.current, p];
      lastPointRef.current = p;
      setTrack(trackRef.current);
      setDistanceKm(distanceRef.current / 1000);
    }

    const speed = p.speedKmh;
    setCurrentSpeed(speed);
    if (speed > maxSpeedRef.current) {
      maxSpeedRef.current = speed;
      setMaxSpeed(speed);
    }
  }, []);

  const startWatch = useCallback(async () => {
    if (Platform.OS === 'web') {
      const stop = createMockLocationWatcher((loc) => {
        const speedKmh = loc.speed != null ? loc.speed * MS_TO_KMH : 0;
        pushPoint({
          latitude: loc.latitude,
          longitude: loc.longitude,
          altitude: loc.altitude,
          timestamp: loc.timestamp,
          speedKmh,
          accuracy: loc.accuracy,
        });
      });
      subRef.current = { remove: stop };
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied. Enable location in settings to record rides.');
    }
    try {
      await Location.requestBackgroundPermissionsAsync();
    } catch {
      // background optional
    }

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (loc) => {
        const c = loc.coords;
        const speedKmh = c.speed != null && c.speed >= 0 ? c.speed * MS_TO_KMH : 0;
        pushPoint({
          latitude: c.latitude,
          longitude: c.longitude,
          altitude: c.altitude,
          timestamp: loc.timestamp,
          speedKmh,
          accuracy: c.accuracy,
        });
      },
    );
    subRef.current = sub as unknown as Subscription;
  }, [pushPoint]);

  const stopWatch = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    startRef.current = Date.now();
    lastMoveRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (stateRef.current !== 'recording') return;
      const now = Date.now();
      accumulatedMovingRef.current += (now - lastMoveRef.current) / 1000;
      lastMoveRef.current = now;
      setMovingTimeSec(Math.floor(accumulatedMovingRef.current));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      await startWatch();
      accumulatedMovingRef.current = 0;
      distanceRef.current = 0;
      maxSpeedRef.current = 0;
      trackRef.current = [];
      lastPointRef.current = null;
      setTrack([]);
      setDistanceKm(0);
      setMovingTimeSec(0);
      setMaxSpeed(0);
      setCurrentSpeed(0);
      setState('recording');
      startTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start recording');
    }
  }, [startWatch, startTimer]);

  const pause = useCallback(() => {
    setState('paused');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopWatch();
    setCurrentSpeed(0);
  }, [stopWatch]);

  const resume = useCallback(async () => {
    setError(null);
    try {
      await startWatch();
      lastMoveRef.current = Date.now();
      setState('recording');
      startTimer();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resume recording');
    }
  }, [startWatch, startTimer]);

  const stop = useCallback((): TrackPoint[] => {
    setState('idle');
    stopTimer();
    stopWatch();
    setCurrentSpeed(0);
    const finalTrack = trackRef.current;
    const finalDistance = distanceRef.current / 1000;
    const finalTime = accumulatedMovingRef.current;
    const finalMax = maxSpeedRef.current;
    void finalDistance;
    void finalTime;
    void finalMax;
    return finalTrack;
  }, [stopTimer, stopWatch]);

  const finalizeStats = useCallback(() => {
    const finalTrack = trackRef.current;
    const finalDistance = distanceRef.current / 1000;
    const finalTime = accumulatedMovingRef.current;
    const finalMax = maxSpeedRef.current;
    const avg = finalTime > 0 ? (finalDistance / (finalTime / 3600)) : 0;
    return {
      track: finalTrack,
      distanceKm: finalDistance,
      movingTimeSec: Math.floor(finalTime),
      avgSpeed: avg,
      maxSpeed: finalMax,
    };
  }, []);

  const reset = useCallback(() => {
    stop();
    accumulatedMovingRef.current = 0;
    distanceRef.current = 0;
    maxSpeedRef.current = 0;
    trackRef.current = [];
    lastPointRef.current = null;
    setTrack([]);
    setDistanceKm(0);
    setMovingTimeSec(0);
    setMaxSpeed(0);
    setCurrentSpeed(0);
    setError(null);
  }, [stop]);

  const locateMe = useCallback(async (): Promise<LatLng | null> => {
    setIsLocating(true);
    try {
      const pos = await getCurrentLocation();
      if (pos) {
        setPreviewLocation(pos);
        return pos;
      }
    } catch (e) {
      console.warn('locateMe failed:', e);
    } finally {
      setIsLocating(false);
    }
    return null;
  }, []);

  // Fetch initial location on mount when idle
  useEffect(() => {
    if (stateRef.current === 'idle') {
      locateMe();
    }
  }, [locateMe]);

  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      void next;
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return () => {
      stopWatch();
      stopTimer();
    };
  }, [stopWatch, stopTimer]);

  const avgSpeed = movingTimeSec > 0 ? (distanceKm / (movingTimeSec / 3600)) : 0;

  const stats: RecordingStats = {
    state,
    currentSpeed,
    distanceKm,
    movingTimeSec,
    avgSpeed,
    maxSpeed,
    track,
    lastPoint: lastPointRef.current,
    previewLocation,
    isLocating,
    error,
  };

  return { stats, start, pause, resume, stop, finalizeStats, reset, locateMe };
}
