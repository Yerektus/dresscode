import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { uiColors } from './colors';

interface AvatarProps {
  label?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

function resolveAvatarLetter(label: string | null | undefined): string {
  const normalized = label?.trim();
  if (!normalized) {
    return '?';
  }

  return normalized.charAt(0).toUpperCase();
}

export function Avatar({ label, style, textStyle }: AvatarProps) {
  const fontSize = 15

  return (
    <View
      style={[
        styles.base,
        {
          width: 43.5,
          height: 43.5,
          borderRadius: 999,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize }, textStyle]}>{resolveAvatarLetter(label)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: uiColors.surfaceSoft,
    borderWidth: 1,
    borderColor: uiColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
    color: uiColors.textOnLight,
  },
});
