import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Circle, LocateFixed, MapPin, Pause, Play, Square } from 'lucide-react-native';
import { useRideRecorder } from '../../src/hooks/useRideRecorder';
import { RouteMap } from '../../src/components/RouteMap';
import { MetricCard } from '../../src/components/MetricCard';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { formatDuration } from '../../src/utils/geo';
import { makeRideId, saveRide } from '../../src/utils/storage';
import { theme } from '../../src/theme';
import type { Ride } from '../../src/types';

export default function RecordRideScreen() {
  const { stats, start, pause, resume, stop, finalizeStats, reset, locateMe } = useRideRecorder();
  const [confirmStop, setConfirmStop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recenterTarget, setRecenterTarget] = useState<{ latitude: number; longitude: number } | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ saved?: string }>();

  useFocusEffect(
    useMemo(() => () => {}, []),
  );

  const route = useMemo(
    () => stats.track.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [stats.track],
  );

  const initialRegion = (stats.lastPoint ?? stats.previewLocation)
    ? {
        latitude: (stats.lastPoint ?? stats.previewLocation)!.latitude,
        longitude: (stats.lastPoint ?? stats.previewLocation)!.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : undefined;

  const handleLocatePress = async () => {
    if (stats.lastPoint) {
      setRecenterTarget({
        latitude: stats.lastPoint.latitude,
        longitude: stats.lastPoint.longitude,
      });
    } else {
      const pos = await locateMe();
      if (pos) {
        setRecenterTarget({ ...pos });
      }
    }
  };

  const handleStart = () => {
    reset();
    start();
  };

  const handleSave = async () => {
    setConfirmStop(false);
    setSaving(true);
    const finalStats = finalizeStats();
    stop();
    if (finalStats.track.length < 2 || finalStats.distanceKm < 0.01) {
      setSaving(false);
      Alert.alert('Ride too short', 'Not enough GPS points to save this ride.');
      reset();
      return;
    }
    const ride: Ride = {
      id: makeRideId(),
      startedAt: Date.now() - finalStats.movingTimeSec * 1000,
      endedAt: Date.now(),
      distanceKm: finalStats.distanceKm,
      movingTimeSec: finalStats.movingTimeSec,
      avgSpeed: finalStats.avgSpeed,
      maxSpeed: finalStats.maxSpeed,
      track: finalStats.track,
    };
    try {
      await saveRide(ride);
      reset();
      router.push({ pathname: '/ride/[id]', params: { id: ride.id, saved: '1' } });
    } catch (e) {
      setSaving(false);
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save ride.');
    }
  };

  const isMock = Platform.OS === 'web';

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <RouteMap
          route={route}
          initialRegion={initialRegion}
          follow
          showUserDot
          userLocation={stats.previewLocation}
          recenterLocation={recenterTarget}
        />
        <TouchableOpacity
          style={styles.locateBtn}
          onPress={handleLocatePress}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {stats.isLocating ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <LocateFixed size={18} color={theme.accent} />
          )}
        </TouchableOpacity>
        {isMock && stats.state === 'idle' && (
          <View style={styles.mockBadge}>
            <Text style={styles.mockBadgeText}>Kraków GPS Preview · Tap START to record</Text>
          </View>
        )}
      </View>

      <View style={styles.dashboard}>
        <View style={styles.primaryMetric}>
          <Text style={styles.speedValue} numberOfLines={1} adjustsFontSizeToFit>
            {stats.currentSpeed.toFixed(1)}
          </Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            value={formatDuration(stats.movingTimeSec)}
            unit="time"
            label="Elapsed"
          />
          <MetricCard
            value={stats.distanceKm.toFixed(2)}
            unit="km"
            label="Distance"
            highlight
          />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard
            value={stats.avgSpeed.toFixed(1)}
            unit="km/h"
            label="Average"
          />
          <MetricCard
            value={stats.maxSpeed.toFixed(1)}
            unit="km/h"
            label="Max"
          />
        </View>

        {stats.error && (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{stats.error}</Text>
          </View>
        )}

        <View style={styles.controls}>
          {stats.state === 'idle' && (
            <TouchableOpacity
              style={[styles.controlBtn, styles.startBtn]}
              onPress={handleStart}
              activeOpacity={0.8}
            >
              <Play color={theme.bg} size={26} />
              <Text style={styles.startText}>START</Text>
            </TouchableOpacity>
          )}

          {stats.state === 'recording' && (
            <>
              <TouchableOpacity
                style={[styles.controlBtn, styles.pauseBtn]}
                onPress={pause}
                activeOpacity={0.8}
              >
                <Pause color={theme.bg} size={24} />
                <Text style={styles.pauseText}>PAUSE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlBtn, styles.stopBtn]}
                onPress={() => setConfirmStop(true)}
                activeOpacity={0.8}
              >
                <Square color={theme.text} size={22} />
                <Text style={styles.stopText}>STOP</Text>
              </TouchableOpacity>
            </>
          )}

          {stats.state === 'paused' && (
            <>
              <TouchableOpacity
                style={[styles.controlBtn, styles.resumeBtn]}
                onPress={resume}
                activeOpacity={0.8}
              >
                <Play color={theme.bg} size={24} />
                <Text style={styles.resumeText}>RESUME</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlBtn, styles.stopBtn]}
                onPress={() => setConfirmStop(true)}
                activeOpacity={0.8}
              >
                <Square color={theme.text} size={22} />
                <Text style={styles.stopText}>SAVE</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {saving && (
          <View style={styles.savingBar}>
            <Circle color={theme.accent} size={14} />
            <Text style={styles.savingText}>Saving ride...</Text>
          </View>
        )}

        {params.saved && !saving && stats.state === 'idle' && (
          <View style={styles.savedBar}>
            <MapPin color={theme.accent} size={14} />
            <Text style={styles.savedText}>Ride saved to history</Text>
          </View>
        )}
      </View>

      <ConfirmModal
        visible={confirmStop}
        title="Stop & Save Ride?"
        message={`Distance: ${stats.distanceKm.toFixed(2)} km · Time: ${formatDuration(stats.movingTimeSec)}\n\nSave this ride to your history?`}
        confirmText="Save Ride"
        cancelText="Discard"
        onConfirm={handleSave}
        onCancel={() => {
          setConfirmStop(false);
          reset();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  mapWrap: { flex: 1, position: 'relative' },
  dashboard: {
    backgroundColor: theme.bg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    padding: 14,
    paddingBottom: 8,
  },
  primaryMetric: {
    alignItems: 'center',
    marginBottom: 10,
  },
  speedValue: {
    color: theme.text,
    fontSize: 56,
    fontWeight: '900',
    fontFamily: 'Inter-Bold',
    fontVariant: ['tabular-nums'],
  },
  speedUnit: {
    color: theme.accent,
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    marginTop: -4,
    letterSpacing: 2,
  },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  controls: { flexDirection: 'row', gap: 10, marginTop: 4 },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  startBtn: { backgroundColor: theme.accent },
  startText: { color: theme.bg, fontSize: 18, fontWeight: '900', fontFamily: 'Inter-Bold' },
  pauseBtn: { backgroundColor: theme.warn },
  pauseText: { color: theme.bg, fontSize: 16, fontWeight: '800', fontFamily: 'Inter-Bold' },
  stopBtn: { backgroundColor: theme.danger },
  stopText: { color: theme.text, fontSize: 16, fontWeight: '800', fontFamily: 'Inter-Bold' },
  resumeBtn: { backgroundColor: theme.accent },
  resumeText: { color: theme.bg, fontSize: 16, fontWeight: '800', fontFamily: 'Inter-Bold' },
  errorBar: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  errorText: { color: theme.danger, fontSize: 13, fontFamily: 'Inter-Regular' },
  savingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  savingText: { color: theme.accent, fontFamily: 'Inter-Regular', fontSize: 13 },
  savedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  savedText: { color: theme.accent, fontFamily: 'Inter-Regular', fontSize: 13 },
  mockBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  mockBadgeText: { color: theme.textMuted, fontSize: 11, fontFamily: 'Inter-Regular' },
  locateBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 20,
  },
});
