import { View, Text, StyleSheet, Pressable } from 'react-native';

interface HistoryCardProps {
  title: string;
  category: string;
  size: string;
  fitProbability: number;
  date: string;
  onPress?: () => void;
}

export function HistoryCard({ title, category, size, fitProbability, date, onPress }: HistoryCardProps) {
  const fitColor = fitProbability >= 80 ? '#16a34a' : '#ca8a04';

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.badge, { color: fitColor }]}>{fitProbability}%</Text>
      </View>
      <Text style={styles.meta}>{category} · {size} · {date}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
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
    color: '#111',
  },
  badge: {
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    color: '#888',
  },
});
