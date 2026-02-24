import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { uiColors } from '@repo/ui/colors';

export default function TabLayout() {
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
