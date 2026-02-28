import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { AuthProvider } from '@/providers/auth-provider';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const documentRef = (globalThis as { document?: any }).document;
    if (!documentRef) {
      return;
    }

    const interFontUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    const interFontId = 'dresscode-inter-font';
    const interFontStack =
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    const existingLink = documentRef.getElementById(interFontId);
    if (!existingLink) {
      const linkElement = documentRef.createElement('link');
      linkElement.id = interFontId;
      linkElement.rel = 'stylesheet';
      linkElement.href = interFontUrl;
      documentRef.head?.appendChild(linkElement);
    }

    if (documentRef.documentElement?.style) {
      documentRef.documentElement.style.fontFamily = interFontStack;
    }
    if (documentRef.body?.style) {
      documentRef.body.style.fontFamily = interFontStack;
    }
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="landing" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="onboarding-result" />
        <Stack.Screen name="tryon-result" />
        <Stack.Screen name="verify-email" />
      </Stack>
    </AuthProvider>
  );
}
