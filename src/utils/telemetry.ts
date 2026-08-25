import type { TrackPoint } from '../types';
import { haversineMeters } from './geo';

export type TelemetryDataPoint = {
  value: number; // speed in km/h for the chart Y axis
  label?: string; // X-axis label (only set for clean milestone points, e.g. "0.0 km", "1.0 km")
  distanceKm: number;
  speedKmh: number;
  timestamp: number;
  elapsedSec: number;
};

/**
 * Computes cumulative distance along the track in kilometers.
 */
export function computeCumulativeDistances(track: TrackPoint[]): number[] {
  const distances: number[] = [0];
  let cumulative = 0;
  for (let i = 1; i < track.length; i++) {
    const dist = haversineMeters(track[i - 1], track[i]);
    cumulative += dist;
    distances.push(cumulative / 1000);
  }
  return distances;
}

/**
 * Applies a 3-point moving average smoothing filter to remove GPS speed jitter.
 */
export function smoothSpeedSeries(speeds: number[], windowSize = 3): number[] {
  if (speeds.length <= windowSize) return speeds;
  const smoothed: number[] = [];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < speeds.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(speeds.length, i + half + 1);
    const subset = speeds.slice(start, end);
    const avg = subset.reduce((sum, val) => sum + val, 0) / subset.length;
    smoothed.push(Number(avg.toFixed(1)));
  }

  return smoothed;
}

/**
 * Downsamples track points to a manageable target count (e.g. 25-35) using equidistant sampling.
 */
export function downsampleTelemetry(
  track: TrackPoint[],
  targetPoints = 30
): { point: TrackPoint; distanceKm: number; elapsedSec: number }[] {
  if (track.length === 0) return [];
  if (track.length <= targetPoints) {
    const distances = computeCumulativeDistances(track);
    const startTs = track[0].timestamp;
    return track.map((p, i) => ({
      point: p,
      distanceKm: distances[i],
      elapsedSec: Math.max(0, Math.floor((p.timestamp - startTs) / 1000)),
    }));
  }

  const distances = computeCumulativeDistances(track);
  const startTs = track[0].timestamp;
  const totalPoints = track.length;
  const step = (totalPoints - 1) / (targetPoints - 1);
  const result: { point: TrackPoint; distanceKm: number; elapsedSec: number }[] = [];

  for (let i = 0; i < targetPoints; i++) {
    const index = Math.min(Math.round(i * step), totalPoints - 1);
    result.push({
      point: track[index],
      distanceKm: distances[index],
      elapsedSec: Math.max(0, Math.floor((track[index].timestamp - startTs) / 1000)),
    });
  }

  return result;
}

/**
 * Builds clean telemetry series for Speed vs Distance chart with spaced X-axis labels.
 */
export function buildSpeedDistanceSeries(
  track: TrackPoint[],
  targetPoints = 30
): TelemetryDataPoint[] {
  if (track.length === 0) return [];

  const sampled = downsampleTelemetry(track, targetPoints);
  const rawSpeeds = sampled.map((s) => s.point.speedKmh);
  const smoothedSpeeds = smoothSpeedSeries(rawSpeeds);

  const totalDistance = sampled[sampled.length - 1].distanceKm;
  // Show 4-5 labels across the axis
  const labelIntervalIndex = Math.max(1, Math.floor(sampled.length / 4));

  return sampled.map((s, i) => {
    const isFirst = i === 0;
    const isLast = i === sampled.length - 1;
    const isMilestone = i % labelIntervalIndex === 0 && !isLast;

    let label: string | undefined = undefined;
    if (isFirst) {
      label = '0.0 km';
    } else if (isMilestone) {
      label = `${s.distanceKm.toFixed(1)} km`;
    } else if (isLast) {
      label = `${totalDistance.toFixed(1)} km`;
    }

    return {
      value: smoothedSpeeds[i],
      label: label ?? ' ',
      distanceKm: Number(s.distanceKm.toFixed(2)),
      speedKmh: smoothedSpeeds[i],
      timestamp: s.point.timestamp,
      elapsedSec: s.elapsedSec,
    };
  });
}

/**
 * Builds clean telemetry series for Speed vs Time chart with spaced X-axis labels.
 */
export function buildSpeedTimeSeries(
  track: TrackPoint[],
  targetPoints = 30
): TelemetryDataPoint[] {
  if (track.length === 0) return [];

  const sampled = downsampleTelemetry(track, targetPoints);
  const rawSpeeds = sampled.map((s) => s.point.speedKmh);
  const smoothedSpeeds = smoothSpeedSeries(rawSpeeds);

  const labelIntervalIndex = Math.max(1, Math.floor(sampled.length / 4));

  return sampled.map((s, i) => {
    const isFirst = i === 0;
    const isLast = i === sampled.length - 1;
    const isMilestone = i % labelIntervalIndex === 0 && !isLast;

    let label: string | undefined = undefined;
    if (isFirst) {
      label = '00:00';
    } else if (isMilestone || isLast) {
      const m = Math.floor(s.elapsedSec / 60);
      const sec = s.elapsedSec % 60;
      label = `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    return {
      value: smoothedSpeeds[i],
      label: label ?? ' ',
      distanceKm: Number(s.distanceKm.toFixed(2)),
      speedKmh: smoothedSpeeds[i],
      timestamp: s.point.timestamp,
      elapsedSec: s.elapsedSec,
    };
  });
}
