import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Gauge, MapPin, Timer, TrendingUp } from 'lucide-react-native';
import { LineChart } from 'react-native-gifted-charts';
import { loadRide } from '../../src/utils/storage';
import { RouteMap } from '../../src/components/RouteMap';
import { MetricCard } from '../../src/components/MetricCard';
import { formatClock, formatDate, formatDuration } from '../../src/utils/geo';
import { theme } from '../../src/theme';
import type { Ride } from '../../src/types';

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadRide(id)
      .then((r) => setRide(r))
      .finally(() => setLoading(false));
  }, [id]);

  const route = useMemo(
    () => (ride ? ride.track.map((p) => ({ latitude: p.latitude, longitude: p.longitude })) : []),
    [ride],
  );

  const chartData = useMemo(() => {
    if (!ride || ride.track.length === 0) return [];
    const start = ride.track[0].timestamp;
    return ride.track.map((p) => ({
      value: Number(p.speedKmh.toFixed(1)),
      label: `${Math.floor((p.timestamp - start) / 1000)}s`,
    }));
  }, [ride]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading ride...</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Ride not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <ArrowLeft
          color={theme.text}
          size={24}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/(tabs)/history');
          }}
          style={styles.backIcon}
        />
        <View style={styles.topBarTitle}>
          <Text style={styles.titleDate}>{formatDate(ride.startedAt)}</Text>
          <Text style={styles.titleTime}>
            {formatClock(ride.startedAt)} – {formatClock(ride.endedAt)}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.mapCard}>
          <RouteMap route={route} />
        </View>

        <View style={styles.summaryRow}>
          <MetricCard
            value={ride.distanceKm.toFixed(2)}
            unit="km"
            label="Distance"
            highlight
          />
          <MetricCard
            value={formatDuration(ride.movingTimeSec)}
            unit="time"
            label="Moving"
          />
        </View>
        <View style={styles.summaryRow}>
          <MetricCard value={ride.avgSpeed.toFixed(1)} unit="km/h" label="Average" />
          <MetricCard value={ride.maxSpeed.toFixed(1)} unit="km/h" label="Peak" />
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <TrendingUp color={theme.accent} size={18} />
            <Text style={styles.chartTitle}>Speed vs Time</Text>
          </View>
          {chartData.length > 1 ? (
            <LineChart
              data={chartData}
              areaChart
              curved
              isAnimated
              color={theme.accent}
              thickness={3}
              startFillColor={theme.accent}
              endFillColor={theme.accentDim}
              startOpacity={0.4}
              endOpacity={0.05}
              xAxisColor={theme.border}
              yAxisColor={theme.border}
              yAxisTextStyle={{ color: theme.textMuted, fontSize: 10, fontFamily: 'Inter-Regular' }}
              xAxisLabelTextStyle={{ color: theme.textMuted, fontSize: 10, fontFamily: 'Inter-Regular' }}
              noOfSections={4}
              backgroundColor="transparent"
              height={180}
            />
          ) : (
            <Text style={styles.noChartText}>Not enough data points for a chart.</Text>
          )}
          <View style={styles.chartLegend}>
            <Text style={styles.legendText}>X: elapsed seconds · Y: km/h</Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statLine}>
            <MapPin color={theme.accent} size={16} />
            <Text style={styles.statLineText}>Total distance</Text>
            <Text style={styles.statLineValue}>{ride.distanceKm.toFixed(2)} km</Text>
          </View>
          <View style={styles.statLine}>
            <Timer color={theme.textMuted} size={16} />
            <Text style={styles.statLineText}>Moving time</Text>
            <Text style={styles.statLineValue}>{formatDuration(ride.movingTimeSec)}</Text>
          </View>
          <View style={styles.statLine}>
            <Gauge color={theme.textMuted} size={16} />
            <Text style={styles.statLineText}>Average speed</Text>
            <Text style={styles.statLineValue}>{ride.avgSpeed.toFixed(1)} km/h</Text>
          </View>
          <View style={[styles.statLine, { borderBottomWidth: 0 }]}>
            <TrendingUp color={theme.textMuted} size={16} />
            <Text style={styles.statLineText}>Peak speed</Text>
            <Text style={styles.statLineValue}>{ride.maxSpeed.toFixed(1)} km/h</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
  loadingText: { color: theme.textMuted, fontSize: 16, fontFamily: 'Inter-Regular' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 12,
  },
  backIcon: { padding: 4 },
  topBarTitle: { flex: 1 },
  titleDate: { color: theme.text, fontSize: 17, fontWeight: '800', fontFamily: 'Inter-Bold' },
  titleTime: { color: theme.textMuted, fontSize: 13, marginTop: 2, fontFamily: 'Inter-Regular' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 14 },
  mapCard: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  summaryRow: { flexDirection: 'row', gap: 12 },
  chartCard: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  chartTitle: { color: theme.text, fontSize: 15, fontWeight: '700', fontFamily: 'Inter-Bold' },
  noChartText: { color: theme.textMuted, fontSize: 13, fontFamily: 'Inter-Regular', paddingVertical: 20 },
  chartLegend: { marginTop: 8 },
  legendText: { color: theme.textDim, fontSize: 11, fontFamily: 'Inter-Regular' },
  statsCard: {
    backgroundColor: theme.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  statLineText: { color: theme.textMuted, fontSize: 14, flex: 1, fontFamily: 'Inter-Regular' },
  statLineValue: { color: theme.text, fontSize: 15, fontWeight: '700', fontFamily: 'Inter-Bold' },
});
