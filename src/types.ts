export type LatLng = {
  latitude: number;
  longitude: number;
};

export type TrackPoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
  speedKmh: number;
  accuracy: number | null;
};

export type Ride = {
  id: string;
  startedAt: number;
  endedAt: number;
  distanceKm: number;
  movingTimeSec: number;
  avgSpeed: number;
  maxSpeed: number;
  track: TrackPoint[];
};

export type RideSummary = Omit<Ride, 'track'>;

export type RecordingState = 'idle' | 'recording' | 'paused';
