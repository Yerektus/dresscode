import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { uiColors } from './colors';

interface BodyMetricCardProps {
  label: string;
  value: string;
  style?: StyleProp<ViewStyle>;
}

export function BodyMetricCard({ label, value, style }: BodyMetricCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 24,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: uiColors.surface,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: uiColors.textMuted,
    marginBottom: 8,
  },
  value: {
    textAlign: 'right',
    fontSize: 40,
    fontWeight: '600',
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: uiColors.textPrimary,
  },
});
