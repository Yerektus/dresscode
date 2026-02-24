import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomePage() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <Text style={styles.logo}>DRESSCODE</Text>
        <View style={styles.navLinks}>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.navLink}>Sign In</Text>
          </Pressable>
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
        <Pressable
          style={styles.cta}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.ctaText}>Get Started Free</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
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
    color: '#111',
  },
  navLinks: {
    flexDirection: 'row',
    gap: 24,
  },
  navLink: {
    fontSize: 15,
    color: '#555',
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
    color: '#888',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  heading: {
    fontSize: Platform.OS === 'web' ? 64 : 40,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    lineHeight: Platform.OS === 'web' ? 72 : 48,
    marginBottom: 24,
    ...(Platform.OS === 'web' ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}),
  },
  subheading: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 560,
    marginBottom: 40,
  },
  cta: {
    backgroundColor: '#111',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 50,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
