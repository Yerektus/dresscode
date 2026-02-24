import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';

const mockHistory = [
  { id: '1', category: 'Top', size: 'M', fit: 87, date: '2026-02-20' },
  { id: '2', category: 'Dress', size: 'S', fit: 72, date: '2026-02-18' },
  { id: '3', category: 'Outerwear', size: 'L', fit: 95, date: '2026-02-15' },
];

export default function HistoryScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>History</Text>
      {mockHistory.map((item) => (
        <Pressable key={item.id} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>{item.category} Try-On</Text>
            <Text style={[styles.fit, { color: item.fit >= 80 ? '#16a34a' : '#ca8a04' }]}>
              {item.fit}%
            </Text>
          </View>
          <Text style={styles.meta}>Size {item.size} · {item.date}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  content: {
    padding: 24,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 24,
    marginTop: Platform.OS === 'web' ? 40 : 60,
    ...(Platform.OS === 'web' ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}),
  },
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
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  fit: {
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    color: '#888',
  },
});
