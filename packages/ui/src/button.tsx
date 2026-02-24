import { useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { uiColors } from './colors';

interface ButtonProps {
  children: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const webHoverTransition = Platform.select({
  web: {
    transitionProperty: 'transform, background-color, border-color',
    transitionDuration: '50ms',
    transitionTimingFunction: 'ease-in-out',
  } as unknown as ViewStyle,
});

export function Button({ children, onPress, variant = 'primary', style, textStyle }: ButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={[
        styles.base,
        webHoverTransition,
        isSecondary ? styles.secondary : styles.primary,
        isHovered && (isSecondary ? styles.secondaryHover : styles.primaryHover),
        isHovered && styles.hoverScale,
        style,
      ]}
    >
      <Text style={[styles.text, isSecondary && styles.textSecondary, textStyle]}>
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
  primaryHover: {
    backgroundColor: uiColors.buttonHover,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: uiColors.borderStrong,
  },
  secondaryHover: {
    backgroundColor: 'rgba(37, 37, 35, 0.1)',
  },
  hoverScale: {
    transform: [{ scale: 1.005 }],
  },
  text: {
    fontSize: 15,
    fontWeight: '400',
    color: uiColors.textOnDark,
  },
  textSecondary: {
    color: uiColors.textOnDark,
  },
});
