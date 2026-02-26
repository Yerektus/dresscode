import { View, Text, StyleSheet, Pressable } from 'react-native';
import { uiColors } from './colors';

interface HistoryCardProps {
  title: string;
  category: string;
  size: string;
  fitProbability: number;
  date: string;
  measurements?: string;
  onPress?: () => void;
}

export function HistoryCard({
  title,
  category,
  size,
  fitProbability,
  date,
  measurements,
  onPress,
}: HistoryCardProps) {
  const fitColor = fitProbability >= 80 ? uiColors.success : uiColors.warning;
  const metaParts = [category, size, measurements, date].filter((part): part is string => Boolean(part));

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.badge, { color: fitColor }]}>{fitProbability}%</Text>
      </View>
      <Text style={styles.meta}>{metaParts.join(' · ')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: uiColors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: uiColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: uiColors.textPrimary,
  },
  badge: {
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    color: uiColors.textMuted,
  },
});
