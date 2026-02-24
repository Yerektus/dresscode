import { ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { uiColors } from './colors';

interface ScreenContainerProps {
  children: ReactNode;
  leading?: ReactNode;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  centerContent?: boolean;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}

export function ScreenContainer({
  children,
  leading,
  title,
  subtitle,
  scroll = true,
  centerContent = false,
  maxWidth = 600,
  style,
  contentStyle,
  titleStyle,
}: ScreenContainerProps) {
  const content = (
    <View
      style={[
        styles.content,
        { maxWidth },
        centerContent && styles.centered,
        contentStyle,
      ]}
    >
      {leading}
      {title ? <Text style={[styles.title, titleStyle]}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );

  if (!scroll) {
    return <View style={[styles.container, style]}>{content}</View>;
  }

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.scrollContent, centerContent && styles.scrollCentered]}
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: uiColors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollCentered: {
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    padding: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: uiColors.textPrimary,
    marginBottom: 12,
    ...(Platform.OS === 'web' ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}),
  },
  subtitle: {
    fontSize: 16,
    color: uiColors.textMuted,
    lineHeight: 24,
    marginBottom: 32,
  },
});
