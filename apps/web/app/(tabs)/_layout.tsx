import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { uiColors } from '@repo/ui/colors';
import { useAuth } from '@/providers/auth-provider';

export default function TabLayout() {
  const { isAuthenticated, isLoading, getPostAuthRoute } = useAuth();
  const [canAccessMain, setCanAccessMain] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      setCanAccessMain(null);
      return;
    }

    let active = true;
    const checkMainAccess = async () => {
      try {
        const route = await getPostAuthRoute();
        if (active) {
          setCanAccessMain(route === '/(tabs)');
        }
      } catch {
        if (active) {
          setCanAccessMain(false);
        }
      }
    };

    void checkMainAccess();

    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoading, getPostAuthRoute]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (canAccessMain === null) {
    return null;
  }

  if (!canAccessMain) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: uiColors.surface,
          borderTopColor: uiColors.borderSoft,
          ...(Platform.OS === 'web' ? { height: 60 } : {}),
        },
        tabBarActiveTintColor: uiColors.textPrimary,
        tabBarInactiveTintColor: uiColors.textSubtle,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Try On' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
