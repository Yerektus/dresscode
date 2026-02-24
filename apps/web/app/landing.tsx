import { View, Text, StyleSheet, Platform } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Button } from '@repo/ui/button';
import { uiColors } from '@repo/ui/colors';
import { useAuth } from '@/providers/auth-provider';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <Text style={styles.logo}>DRESSCODE</Text>
        <View style={styles.navLinks}>
          <Button onPress={() => router.push('/(auth)/login')}>
            Try It Now
          </Button>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.badge}>AI-Powered Virtual Try-On</Text>
        <Text style={styles.heading}>
          {'Try Before\nYou Buy.'}
        </Text>
        <Text style={styles.subheading}>
          Upload any garment, see how it fits your body, and get instant size recommendations — all powered by AI.
        </Text>
        <Button onPress={() => router.push('/(auth)/register')}>
          Get Started Free
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: uiColors.background,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 20,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  logo: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: uiColors.textPrimary,
  },
  navLinks: {
    flexDirection: 'row',
    gap: 24,
  },
  navLink: {
    fontSize: 15,
    color: uiColors.textSecondary,
    fontWeight: '500',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 800,
    alignSelf: 'center',
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    color: uiColors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  heading: {
    fontSize: Platform.OS === 'web' ? 64 : 40,
    fontWeight: '700',
    color: uiColors.textPrimary,
    textAlign: 'center',
    lineHeight: Platform.OS === 'web' ? 72 : 48,
    marginBottom: 24,
    ...(Platform.OS === 'web'
      ? {
          fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }
      : {}),
  },
  subheading: {
    fontSize: 18,
    color: uiColors.textTertiary,
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 560,
    marginBottom: 40,
  },
});
