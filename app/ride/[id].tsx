import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Gauge, MapPin, Timer, TrendingUp } from 'lucide-react-native';
import { LineChart } from 'react-native-gifted-charts';
import { loadRide } from '../../src/utils/storage';
import { RouteMap } from '../../src/components/RouteMap';
import { MetricCard } from '../../src/components/MetricCard';
import { formatClock, formatDate, formatDuration } from '../../src/utils/geo';
import { buildSpeedDistanceSeries, buildSpeedTimeSeries } from '../../src/utils/telemetry';
import { theme } from '../../src/theme';
import type { Ride } from '../../src/types';

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState<'distance' | 'time'>('distance');

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
    return chartMetric === 'distance'
      ? buildSpeedDistanceSeries(ride.track, 28)
      : buildSpeedTimeSeries(ride.track, 28);
  }, [ride, chartMetric]);

  const maxChartSpeed = useMemo(() => {
    if (!ride) return 30;
    return Math.max(10, Math.ceil((ride.maxSpeed || 20) / 10) * 10);
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
        {/* Hero Route Map */}
        <View style={styles.mapCard}>
          <RouteMap route={route} />
        </View>

        {/* Primary Metric Grid */}
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
            label="Moving Time"
          />
        </View>
        <View style={styles.summaryRow}>
          <MetricCard value={ride.avgSpeed.toFixed(1)} unit="km/h" label="Average Speed" />
          <MetricCard value={ride.maxSpeed.toFixed(1)} unit="km/h" label="Peak Speed" />
        </View>

        {/* Telemetry Analysis Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartHeaderLeft}>
              <TrendingUp color={theme.accent} size={18} />
              <Text style={styles.chartTitle}>Speed Profile</Text>
            </View>
            <View style={styles.chartHeaderBadges}>
              <View style={styles.badgePill}>
                <Text style={styles.badgeLabel}>Avg </Text>
                <Text style={styles.badgeVal}>{ride.avgSpeed.toFixed(1)}</Text>
              </View>
              <View style={styles.badgePill}>
                <Text style={styles.badgeLabel}>Max </Text>
                <Text style={styles.badgeVal}>{ride.maxSpeed.toFixed(1)}</Text>
              </View>
            </View>
          </View>

          {/* Mode Switcher Segmented Control */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, chartMetric === 'distance' && styles.toggleBtnActive]}
              onPress={() => setChartMetric('distance')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  chartMetric === 'distance' && styles.toggleTextActive,
                ]}
              >
                Speed vs Distance
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, chartMetric === 'time' && styles.toggleBtnActive]}
              onPress={() => setChartMetric('time')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  chartMetric === 'time' && styles.toggleTextActive,
                ]}
              >
                Speed vs Time
              </Text>
            </TouchableOpacity>
          </View>

          {chartData.length > 1 ? (
            <View style={styles.chartWrapper}>
              <LineChart
                data={chartData}
                areaChart
                curved
                isAnimated
                color={theme.accent}
                thickness={3}
                startFillColor={theme.accent}
                endFillColor={theme.accentDim}
                startOpacity={0.35}
                endOpacity={0.03}
                xAxisColor={theme.border}
                yAxisColor={theme.border}
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.axisText}
                noOfSections={4}
                maxValue={maxChartSpeed}
                stepValue={maxChartSpeed / 4}
                yAxisLabelSuffix=" km/h"
                backgroundColor="transparent"
                height={180}
                initialSpacing={12}
                endSpacing={12}
                pointerConfig={{
                  pointerStripHeight: 160,
                  pointerStripColor: theme.accent,
                  pointerStripWidth: 2,
                  pointerColor: theme.accent,
                  radius: 5,
                  pointerLabelWidth: 100,
                  pointerLabelHeight: 50,
                  activatePointersOnLongPress: false,
                  autoAdjustPointerLabelPosition: true,
                  pointerLabelComponent: (items: any) => {
                    const item = items[0];
                    if (!item) return null;
                    return (
                      <View style={styles.pointerTooltip}>
                        <Text style={styles.pointerSpeed}>{item.value} km/h</Text>
                        <Text style={styles.pointerDetail}>
                          {chartMetric === 'distance'
                            ? `${item.distanceKm} km`
                            : formatDuration(item.elapsedSec ?? 0)}
                        </Text>
                      </View>
                    );
                  },
                }}
              />
            </View>
          ) : (
            <Text style={styles.noChartText}>Not enough GPS points for telemetry chart.</Text>
          )}

          <View style={styles.chartLegend}>
            <Text style={styles.legendText}>
              {chartMetric === 'distance'
                ? 'X: cumulative distance (km) · Y: speed (km/h) · Tap graph for exact values'
                : 'X: elapsed duration (mm:ss) · Y: speed (km/h) · Tap graph for exact values'}
            </Text>
          </View>
        </View>

        {/* Detailed Breakdown Card */}
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
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartTitle: { color: theme.text, fontSize: 15, fontWeight: '700', fontFamily: 'Inter-Bold' },
  chartHeaderBadges: { flexDirection: 'row', gap: 6 },
  badgePill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  badgeLabel: { color: theme.textMuted, fontSize: 11, fontFamily: 'Inter-Regular' },
  badgeVal: { color: theme.accent, fontSize: 11, fontWeight: '700', fontFamily: 'Inter-Bold' },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: theme.bgCardAlt,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: theme.bgElevated,
    borderWidth: 1,
    borderColor: theme.accentDim,
  },
  toggleText: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-Regular',
  },
  toggleTextActive: {
    color: theme.accent,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  chartWrapper: {
    marginHorizontal: -8,
    paddingRight: 10,
  },
  axisText: {
    color: theme.textMuted,
    fontSize: 10,
    fontFamily: 'Inter-Regular',
  },
  pointerTooltip: {
    backgroundColor: theme.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.accent,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  pointerSpeed: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  pointerDetail: {
    color: theme.textMuted,
    fontSize: 10,
    fontFamily: 'Inter-Regular',
  },
  noChartText: { color: theme.textMuted, fontSize: 13, fontFamily: 'Inter-Regular', paddingVertical: 20 },
  chartLegend: { marginTop: 10, alignItems: 'center' },
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

