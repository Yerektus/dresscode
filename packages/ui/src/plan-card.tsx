import { StyleSheet, Text, View } from 'react-native';

interface PlanCardProps {
  name: string;
  detail: string;
}

export function PlanCard({ name, detail }: PlanCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
    color: '#888',
  },
});
