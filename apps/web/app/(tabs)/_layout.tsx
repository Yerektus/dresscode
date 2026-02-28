import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar } from '@repo/ui/avatar';
import { uiColors } from '@repo/ui/colors';
import { useAuth } from '@/providers/auth-provider';
import * as api from '@/services/api';

function getActiveDesktopTab(pathname: string): 'try-on' | 'history' | null {
  if (pathname.startsWith('/(tabs)/history')) {
    return 'history';
  }

  if (pathname === '/(tabs)' || pathname === '/(tabs)/' || pathname.startsWith('/(tabs)/index')) {
    return 'try-on';
  }

  return null;
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, getPostAuthRoute, user, signOut } = useAuth();
  const [canAccessMain, setCanAccessMain] = useState<boolean | null>(null);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [subscription, setSubscription] = useState<api.SubscriptionResponse | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState(false);

  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const activeDesktopTab = useMemo(
    () => getActiveDesktopTab(pathname),
    [pathname],
  );

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

  const loadSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      setIsSubscriptionLoading(true);
      setSubscriptionError(false);
      const nextSubscription = await api.getSubscription();
      setSubscription(nextSubscription);
    } catch {
      setSubscription(null);
      setSubscriptionError(true);
    } finally {
      setIsSubscriptionLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || canAccessMain !== true) {
      return;
    }

    void loadSubscription();
  }, [canAccessMain, isAuthenticated, loadSubscription]);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated || canAccessMain !== true) {
        return;
      }

      void loadSubscription();
    }, [canAccessMain, isAuthenticated, loadSubscription]),
  );

  useEffect(() => {
    if (!isDesktopWeb || !isAuthenticated || canAccessMain !== true) {
      return;
    }

    const windowRef = globalThis.window;
    if (!windowRef) {
      return;
    }

    const handleWindowFocus = () => {
      void loadSubscription();
    };

    windowRef.addEventListener('focus', handleWindowFocus);

    return () => {
      windowRef.removeEventListener('focus', handleWindowFocus);
    };
  }, [canAccessMain, isAuthenticated, isDesktopWeb, loadSubscription]);

  useEffect(() => {
    setIsAvatarMenuOpen(false);
  }, [pathname]);

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

  const creditsValue = isSubscriptionLoading
    ? 'Loading...'
    : subscription
      ? `${subscription.credits_balance} left`
      : subscriptionError
        ? 'Unavailable'
        : 'Loading...';

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isDesktopWeb
          ? styles.desktopTabBarHidden
          : {
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
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );

  if (!isDesktopWeb) {
    return tabs;
  }

  return (
    <View style={styles.desktopShell}>
      {isAvatarMenuOpen ? (
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setIsAvatarMenuOpen(false)}
        />
      ) : null}

      <View style={styles.desktopHeader}>
        <View style={styles.desktopHeaderInner}>
          <View style={styles.brandContainer}>
            <Text style={styles.logo}>DRESSCODE</Text>
          </View>

          <View style={styles.desktopNavContainer}>
            <View style={styles.desktopNav}>
              <Pressable
                onPress={() => router.replace('/(tabs)')}
                style={({ hovered }) => [
                  styles.desktopNavItem,
                  activeDesktopTab === 'try-on' && styles.desktopNavItemActive,
                  hovered && activeDesktopTab !== 'try-on' && styles.desktopNavItemHover,
                ]}
              >
                <Text
                  style={[
                    styles.desktopNavText,
                    activeDesktopTab === 'try-on' && styles.desktopNavTextActive,
                  ]}
                >
                  Try On
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.replace('/(tabs)/history')}
                style={({ hovered }) => [
                  styles.desktopNavItem,
                  activeDesktopTab === 'history' && styles.desktopNavItemActive,
                  hovered && activeDesktopTab !== 'history' && styles.desktopNavItemHover,
                ]}
              >
                <Text
                  style={[
                    styles.desktopNavText,
                    activeDesktopTab === 'history' && styles.desktopNavTextActive,
                  ]}
                >
                  History
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.desktopActions}>
            <Pressable
              onPress={() => setIsAvatarMenuOpen((current) => !current)}
              style={({ hovered }) => [
                styles.avatarTrigger,
                isAvatarMenuOpen && styles.avatarTriggerOpen,
                hovered && styles.avatarTriggerHover,
              ]}
            >
              <Avatar label={user?.email ?? null} />
            </Pressable>

            {isAvatarMenuOpen ? (
              <View style={styles.avatarMenu}>
                <View style={styles.avatarMenuCreditsBlock}>
                  <Text style={styles.avatarMenuLabel}>Credits</Text>
                  <Text style={styles.avatarMenuValue}>{creditsValue}</Text>
                </View>

                <View style={styles.avatarMenuDivider} />

                <Pressable
                  onPress={() => {
                    setIsAvatarMenuOpen(false);
                    router.replace('/(tabs)/settings');
                  }}
                  style={({ hovered }) => [
                    styles.avatarMenuAction,
                    hovered && styles.avatarMenuActionHover,
                  ]}
                >
                  <Text style={styles.avatarMenuActionText}>Settings</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setIsAvatarMenuOpen(false);
                    signOut();
                  }}
                  style={({ hovered }) => [
                    styles.avatarMenuAction,
                    hovered && styles.avatarMenuActionHover,
                  ]}
                >
                  <Text style={styles.avatarMenuLogoutText}>Log out</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.desktopTabsContainer}>{tabs}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopShell: {
    flex: 1,
    backgroundColor: uiColors.background,
  },
  desktopHeader: {
    backgroundColor: uiColors.background,
    paddingVertical: 14,
    paddingHorizontal: 32,
    zIndex: 20,
  },
  desktopHeaderInner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: {
    width: 180,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: uiColors.textPrimary,
  },
  desktopNavContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  desktopNavItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  desktopNavItemHover: {
    backgroundColor: 'rgba(17,17,17,0.04)',
  },
  desktopNavItemActive: {
    backgroundColor: 'rgba(17,17,17,0.06)',
  },
  desktopNavText: {
    fontSize: 15,
    fontWeight: '500',
    color: uiColors.textMuted,
  },
  desktopNavTextActive: {
    backgroundColor: 'rgba(17,17,17,0.04)',
    color: uiColors.textPrimary,
  },
  desktopActions: {
    width: 180,
    alignItems: 'flex-end',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarTrigger: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  avatarTriggerHover: {
    backgroundColor: 'rgba(17,17,17,0.04)',
  },
  avatarTriggerOpen: {
    backgroundColor: 'rgba(17,17,17,0.05)',
  },
  avatarMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 12,
    width: 240,
    backgroundColor: uiColors.surface,
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    borderRadius: 16,
    shadowColor: uiColors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    zIndex: 30,
  },
  avatarMenuCreditsBlock: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  avatarMenuLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: uiColors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  avatarMenuValue: {
    fontSize: 18,
    fontWeight: '600',
    color: uiColors.textPrimary,
  },
  avatarMenuDivider: {
    borderTopWidth: 1,
    borderTopColor: uiColors.borderSoft,
  },
  avatarMenuAction: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatarMenuActionHover: {
    backgroundColor: 'rgba(17,17,17,0.04)',
  },
  avatarMenuActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: uiColors.textPrimary,
  },
  avatarMenuLogoutText: {
    fontSize: 14,
    fontWeight: '500',
    color: uiColors.danger,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  desktopTabsContainer: {
    flex: 1,
  },
  desktopTabBarHidden: {
    display: 'none',
  },
});
