import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
  View,
} from 'react-native';
import { uiColors } from './colors';

interface ButtonProps {
  children: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  loading?: boolean;
  disabled?: boolean;
}

const webHoverTransition = Platform.select({
  web: {
    transitionProperty: 'transform, background-color, border-color',
    transitionDuration: '50ms',
    transitionTimingFunction: 'ease-in-out',
  } as unknown as ViewStyle,
});

export function Button({
  children,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  loading = false,
  disabled = false,
}: ButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isSecondary = variant === 'secondary';
  const isDisabled = disabled || loading;
  const spinnerColor = isSecondary ? uiColors.textOnLight : uiColors.textOnDark;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      onHoverIn={() => {
        if (!isDisabled) {
          setIsHovered(true);
        }
      }}
      onHoverOut={() => setIsHovered(false)}
      style={[
        styles.base,
        webHoverTransition,
        isSecondary ? styles.secondary : styles.primary,
        !isDisabled && isHovered && (isSecondary ? styles.secondaryHover : styles.primaryHover),
        !isDisabled && isHovered && styles.hoverScale,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator size={16} color={spinnerColor} style={styles.spinner} /> : null}
        <Text style={[styles.text, isSecondary && styles.textSecondary, textStyle]}>
          {children}
        </Text>
      </View>
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
    backgroundColor: uiColors.buttonSecondaryHover,
  },
  hoverScale: {
    transform: [{ scale: 1.005 }],
  },
  disabled: {
    opacity: 0.75,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  text: {
    fontSize: 15,
    fontWeight: '400',
    color: uiColors.textOnDark,
  },
  textSecondary: {
    color: uiColors.textOnLight,
  },
});
