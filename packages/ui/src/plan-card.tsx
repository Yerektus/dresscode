import { StyleSheet, Text, View } from 'react-native';
import { uiColors } from './colors';

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
    backgroundColor: uiColors.surface,
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: uiColors.textPrimary,
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
    color: uiColors.textMuted,
  },
});
