import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  children: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
}

export function Button({ children, onPress, variant = 'primary', style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, variant === 'primary' ? styles.primary : styles.secondary, style]}
    >
      <Text style={[styles.text, variant === 'secondary' && styles.textSecondary]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#111',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#111',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  textSecondary: {
    color: '#111',
  },
});
