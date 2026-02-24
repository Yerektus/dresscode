import { View, Text, StyleSheet } from 'react-native';

interface ProbabilityBadgeProps {
  value: number;
  label?: string;
}

export function ProbabilityBadge({ value, label = 'Fit' }: ProbabilityBadgeProps) {
  const color = value >= 80 ? '#16a34a' : value >= 50 ? '#ca8a04' : '#dc2626';
  
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.value, { color }]}>{value}%</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
});
