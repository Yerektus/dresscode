import { Platform, StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { uiColors } from './colors';

interface DisplayTitleProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

export function DisplayTitle({ children, style }: DisplayTitleProps) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: {
    fontWeight: '700',
    color: uiColors.textPrimary,
    marginBottom: 18,
    ...(Platform.OS === 'web'
      ? {
          fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }
      : {}),
  },
});
