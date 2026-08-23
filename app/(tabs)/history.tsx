import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Activity, ChevronRight, MapPin, Trash2 } from 'lucide-react-native';
import { loadRides, deleteRide } from '../../src/utils/storage';
import { formatClock, formatDate, formatDuration } from '../../src/utils/geo';
import { theme } from '../../src/theme';
import type { RideSummary } from '../../src/types';

export default function RideHistoryScreen() {
  const [rides, setRides] = useState<RideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchRides = useCallback(async () => {
    const data = await loadRides();
    setRides(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRides();
    }, [fetchRides]),
  );

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRides();
  };

  const handleDelete = async (id: string) => {
    await deleteRide(id);
    setRides((prev) => prev.filter((r) => r.id !== id));
  };

  const totalDistance = rides.reduce((s, r) => s + r.distanceKm, 0);
  const totalTime = rides.reduce((s, r) => s + r.movingTimeSec, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ride History</Text>
        <Text style={styles.headerSub}>
          {rides.length} {rides.length === 1 ? 'ride' : 'rides'}
          {' · '}
          {totalDistance.toFixed(1)} km total
          {' · '}
          {formatDuration(totalTime)}
        </Text>
      </View>

      {rides.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Activity color={theme.textDim} size={40} />
          <Text style={styles.emptyTitle}>No rides yet</Text>
          <Text style={styles.emptyText}>
            Head to the Record Ride tab and press START to log your first ride.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.rideCard}>
              <TouchableOpacity
                style={styles.rideCardLeft}
                onPress={() => router.push({ pathname: '/ride/[id]', params: { id: item.id } })}
                activeOpacity={0.7}
              >
                <View style={styles.dateBlock}>
                  <Text style={styles.dateText}>{formatDate(item.startedAt)}</Text>
                  <Text style={styles.timeText}>{formatClock(item.startedAt)}</Text>
                </View>
                <View style={styles.rideStats}>
                  <View style={styles.statRow}>
                    <MapPin color={theme.accent} size={14} />
                    <Text style={styles.statValue}>{item.distanceKm.toFixed(2)} km</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Activity color={theme.textMuted} size={14} />
                    <Text style={styles.statSub}>
                      {formatDuration(item.movingTimeSec)} · avg {item.avgSpeed.toFixed(1)} km/h
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <ChevronRight color={theme.accent} size={14} />
                    <Text style={styles.statSub}>max {item.maxSpeed.toFixed(1)} km/h</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item.id)}
                activeOpacity={0.6}
              >
                <Trash2 color={theme.danger} size={18} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { padding: 16, paddingBottom: 8 },
  headerTitle: { color: theme.text, fontSize: 26, fontWeight: '900', fontFamily: 'Inter-Bold' },
  headerSub: { color: theme.textMuted, fontSize: 13, marginTop: 4, fontFamily: 'Inter-Regular' },
  list: { padding: 16, paddingTop: 8, gap: 12 },
  rideCard: {
    flexDirection: 'row',
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  rideCardLeft: { flex: 1, flexDirection: 'row', padding: 14, gap: 14, alignItems: 'center' },
  dateBlock: { width: 92 },
  dateText: { color: theme.text, fontSize: 13, fontWeight: '700', fontFamily: 'Inter-Bold' },
  timeText: { color: theme.textMuted, fontSize: 12, marginTop: 2, fontFamily: 'Inter-Regular' },
  rideStats: { flex: 1, gap: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { color: theme.text, fontSize: 16, fontWeight: '700', fontFamily: 'Inter-Bold' },
  statSub: { color: theme.textMuted, fontSize: 13, fontFamily: 'Inter-Regular' },
  deleteBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: '700', fontFamily: 'Inter-Bold' },
  emptyText: { color: theme.textMuted, fontSize: 14, textAlign: 'center', fontFamily: 'Inter-Regular' },
});
