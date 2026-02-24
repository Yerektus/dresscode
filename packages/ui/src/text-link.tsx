import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { uiColors } from './colors';

interface TextLinkProps {
  children: string;
  onPress?: () => void;
  tone?: 'default' | 'muted' | 'danger';
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
  pressableStyle?: StyleProp<ViewStyle>;
}

export function TextLink({
  children,
  onPress,
  tone = 'default',
  align = 'left',
  style,
  pressableStyle,
}: TextLinkProps) {
  return (
    <Pressable onPress={onPress} style={[styles.pressable, align !== 'left' && { alignItems: alignMap[align] }, pressableStyle]}>
      <Text
        style={[
          styles.text,
          tone === 'muted' && styles.muted,
          tone === 'danger' && styles.danger,
          align !== 'left' && { textAlign: align },
          style,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const alignMap = {
  center: 'center',
  right: 'flex-end',
} as const;

const styles = StyleSheet.create({
  pressable: {
    paddingVertical: 6,
  },
  text: {
    fontSize: 14,
    color: uiColors.textSecondary,
  },
  muted: {
    color: uiColors.textSubtle,
  },
  danger: {
    color: uiColors.danger,
  },
});
