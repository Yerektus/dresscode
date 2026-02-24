import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { uiColors } from '@repo/ui/colors';
import { useAuth } from '@/providers/auth-provider';

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
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
