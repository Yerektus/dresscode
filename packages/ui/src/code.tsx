import { View, Text, StyleSheet } from 'react-native';
import { uiColors } from './colors';

interface ProbabilityBadgeProps {
  value: number;
  label?: string;
}

export function ProbabilityBadge({ value, label = 'Fit' }: ProbabilityBadgeProps) {
  const color = value >= 80 ? uiColors.success : value >= 50 ? uiColors.warning : uiColors.danger;
  
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
    color: uiColors.textMuted,
    marginTop: 2,
  },
});
