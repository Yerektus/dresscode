import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { uiColors } from './colors';

interface SectionTitleProps {
  children: string;
  variant?: 'default' | 'muted';
  style?: StyleProp<TextStyle>;
}

export function SectionTitle({ children, variant = 'default', style }: SectionTitleProps) {
  return (
    <Text style={[styles.base, variant === 'muted' ? styles.muted : styles.default, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    marginBottom: 12,
  },
  default: {
    fontSize: 18,
    fontWeight: '600',
    color: uiColors.textPrimary,
  },
  muted: {
    fontSize: 13,
    fontWeight: '600',
    color: uiColors.textHint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
