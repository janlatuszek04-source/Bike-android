import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

type Metric = {
  value: string;
  unit: string;
  label: string;
  highlight?: boolean;
};

export function MetricCard({ value, unit, label, highlight }: Metric) {
  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.unit}>{unit}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.bgCard,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHighlight: {
    borderColor: theme.accent,
    backgroundColor: theme.bgCardAlt,
    shadowColor: theme.accent,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  value: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Inter-Bold',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: theme.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  label: {
    color: theme.textDim,
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter-Regular',
  },
});
