import { Pressable, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { uiColors } from './colors';

interface ButtonProps {
  children: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({ children, onPress, variant = 'primary', style, textStyle }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, variant === 'primary' ? styles.primary : styles.secondary, style]}
    >
      <Text style={[styles.text, variant === 'secondary' && styles.textSecondary, textStyle]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: uiColors.textOnLight,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: uiColors.borderStrong,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: uiColors.textOnDark,
  },
  textSecondary: {
    color: uiColors.textOnDark,
  },
});
