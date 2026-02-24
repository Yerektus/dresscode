import { Pressable, StyleSheet, Text, View } from 'react-native';
import { uiColors } from './colors';

interface ChoiceChipsProps {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  formatLabel?: (option: string) => string;
}

export function ChoiceChips({ options, value, onChange, formatLabel }: ChoiceChipsProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.text, active && styles.textActive]}>
              {formatLabel ? formatLabel(option) : option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surface,
  },
  chipActive: {
    backgroundColor: uiColors.textPrimary,
    borderColor: uiColors.textPrimary,
  },
  text: {
    fontSize: 14,
    color: uiColors.textSecondary,
    fontWeight: '500',
  },
  textActive: {
    color: uiColors.white,
  },
});
