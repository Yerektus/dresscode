import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ViewStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AlertModal, type AlertModalAction } from '@repo/ui/alert-modal';
import { Avatar } from '@repo/ui/avatar';
import { BodyMetricCard } from '@repo/ui/body-metric-card';
import { Button } from '@repo/ui/button';
import { ScreenContainer } from '@repo/ui/screen-container';
import { SectionTitle } from '@repo/ui/section-title';
import { uiColors } from '@repo/ui/colors';
import { useAuth } from '@/providers/auth-provider';
import * as api from '@/services/api';
import { TextField } from '@repo/ui/text-field';

interface BodyMetricItem {
  key: string;
  label: string;
  value: string;
}

interface SettingsAlertState {
  title: string;
  message?: string;
  actions: AlertModalAction[];
}

const MISSING_VALUE = '—';
const SETTINGS_NAV_ITEMS = ['Profile', 'Mannequin', 'Billing'] as const;
type SettingsNavItem = (typeof SETTINGS_NAV_ITEMS)[number];
const DEFAULT_SETTINGS_NAV_ITEM: SettingsNavItem = 'Profile';
const MANNEQUIN_LEFT_METRIC_KEYS = ['gender', 'chest', 'waist', 'sleeve'] as const;
const MANNEQUIN_RIGHT_METRIC_KEYS = ['height', 'weight', 'hips', 'inseam'] as const;
const MANNEQUIN_CENTER_METRIC_KEY = 'body_shape';
const DEFAULT_CREDIT_PACKAGES: {
  code: api.CreditPackageCode;
  credits: number;
  price_kzt: number;
}[] = [
  { code: 'credits_20', credits: 20, price_kzt: 2000 },
  { code: 'credits_50', credits: 50, price_kzt: 5000 },
  { code: 'credits_100', credits: 100, price_kzt: 10000 },
];
const TELEGRAM_PROFILE_URL = process.env.EXPO_PUBLIC_TELEGRAM_PROFILE_URL ?? 'https://t.me';
const webSidebarTransition = Platform.select({
  web: {
    transitionProperty: 'background-color, transform',
    transitionDuration: '180ms',
    transitionTimingFunction: 'ease',
  } as unknown as ViewStyle,
});
const webSidebarSticky = Platform.select({
  web: {
    position: 'sticky',
    top: 24,
    alignSelf: 'flex-start',
  } as unknown as ViewStyle,
});

function toTitleCase(rawValue: string): string {
  return rawValue
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatGender(gender: api.BodyGender | null | undefined): string {
  if (gender === 'female') {
    return 'Female';
  }

  if (gender === 'male') {
    return 'Male';
  }

  return MISSING_VALUE;
}

function formatNumberMetric(value: unknown, unit: string): string {
  if (value === null || value === undefined || value === '') {
    return MISSING_VALUE;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    const hasFraction = Math.abs(parsed % 1) > 0.001;
    return `${hasFraction ? parsed.toFixed(1) : parsed.toFixed(0)} ${unit}`;
  }

  if (typeof value === 'string' && value.trim()) {
    return `${value.trim()} ${unit}`;
  }

  return MISSING_VALUE;
}

function formatTextMetric(value: string | null | undefined): string {
  if (!value || !value.trim()) {
    return MISSING_VALUE;
  }

  return toTitleCase(value);
}

function formatKzt(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(value);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { updateCurrentUser } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [bodyProfile, setBodyProfile] = useState<api.BodyProfileResponse | null>(null);
  const [subscription, setSubscription] = useState<api.SubscriptionResponse | null>(null);
  const [mannequinImageUrl, setMannequinImageUrl] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isResendingPendingEmail, setIsResendingPendingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isBuyingCredits, setIsBuyingCredits] = useState(false);
  const [alertState, setAlertState] = useState<SettingsAlertState | null>(null);
  const [activeNavItem, setActiveNavItem] = useState<SettingsNavItem>(DEFAULT_SETTINGS_NAV_ITEM);
  const [selectedCreditPackageCode, setSelectedCreditPackageCode] = useState<api.CreditPackageCode>('credits_50');

  useEffect(() => {
    let active = true;

    const loadProfileData = async () => {
      setIsInitialLoading(true);

      const [meResult, bodyResult, subscriptionResult, mannequinResult] = await Promise.allSettled([
        api.getMe(),
        api.getBodyProfile(),
        api.getSubscription(),
        api.getActiveMannequin(),
      ]);

      if (!active) {
        return;
      }

      if (meResult.status === 'fulfilled') {
        setEmailInput(meResult.value.email);
        setSavedEmail(meResult.value.email);
        setPendingEmail(meResult.value.pending_email ?? null);
        updateCurrentUser(meResult.value);
      }

      if (bodyResult.status === 'fulfilled') {
        setBodyProfile(bodyResult.value);
      } else if (bodyResult.reason instanceof api.ApiError && bodyResult.reason.status === 404) {
        setBodyProfile(null);
      } else {
        setBodyProfile(null);
      }

      if (subscriptionResult.status === 'fulfilled') {
        setSubscription(subscriptionResult.value);
      } else {
        setSubscription(null);
      }

      if (mannequinResult.status === 'fulfilled') {
        setMannequinImageUrl(mannequinResult.value.front_image_url);
      } else {
        setMannequinImageUrl(null);
      }

      setIsInitialLoading(false);
    };

    void loadProfileData();

    return () => {
      active = false;
    };
  }, [updateCurrentUser]);

  useFocusEffect(
    useCallback(() => {
      if (activeNavItem !== 'Billing' || isInitialLoading) {
        return;
      }

      let active = true;
      const refreshSubscription = async () => {
        try {
          const nextSubscription = await api.getSubscription();
          if (active) {
            setSubscription(nextSubscription);
          }
        } catch {
          // Keep this silent to avoid interrupting users when returning from checkout.
        }
      };

      void refreshSubscription();

      return () => {
        active = false;
      };
    }, [activeNavItem, isInitialLoading]),
  );

  useEffect(() => {
    const availablePackages = subscription?.credit_packs?.length
      ? subscription.credit_packs
      : DEFAULT_CREDIT_PACKAGES;

    if (!availablePackages.some((pack) => pack.code === selectedCreditPackageCode)) {
      setSelectedCreditPackageCode('credits_50');
    }
  }, [selectedCreditPackageCode, subscription]);

  const bodyMetricCards = useMemo<BodyMetricItem[]>(
    () => [
      {
        key: 'gender',
        label: 'Gender',
        value: formatGender(bodyProfile?.gender),
      },
      {
        key: 'height',
        label: 'Height (cm)',
        value: formatNumberMetric(bodyProfile?.height_cm, 'cm'),
      },
      {
        key: 'weight',
        label: 'Weight (kg)',
        value: formatNumberMetric(bodyProfile?.weight_kg, 'kg'),
      },
      {
        key: 'chest',
        label: 'Chest (cm)',
        value: formatNumberMetric(bodyProfile?.chest_cm, 'cm'),
      },
      {
        key: 'waist',
        label: 'Waist (cm)',
        value: formatNumberMetric(bodyProfile?.waist_cm, 'cm'),
      },
      {
        key: 'hips',
        label: 'Hips (cm)',
        value: formatNumberMetric(bodyProfile?.hips_cm, 'cm'),
      },
      {
        key: 'sleeve',
        label: 'Sleeve (cm)',
        value: formatNumberMetric(bodyProfile?.sleeve_cm, 'cm'),
      },
      {
        key: 'inseam',
        label: 'Inseam (cm)',
        value: formatNumberMetric(bodyProfile?.inseam_cm, 'cm'),
      },
      {
        key: 'body_shape',
        label: 'Body shape',
        value: formatTextMetric(bodyProfile?.body_shape),
      },
    ],
    [bodyProfile],
  );
  const bodyMetricCardMap = useMemo(
    () => new Map(bodyMetricCards.map((card) => [card.key, card])),
    [bodyMetricCards],
  );
  const mannequinLeftCards = useMemo(
    () =>
      MANNEQUIN_LEFT_METRIC_KEYS.map((key) => bodyMetricCardMap.get(key)).filter(
        (card): card is BodyMetricItem => Boolean(card),
      ),
    [bodyMetricCardMap],
  );
  const mannequinRightCards = useMemo(
    () =>
      MANNEQUIN_RIGHT_METRIC_KEYS.map((key) => bodyMetricCardMap.get(key)).filter(
        (card): card is BodyMetricItem => Boolean(card),
      ),
    [bodyMetricCardMap],
  );
  const mannequinCenterCard = bodyMetricCardMap.get(MANNEQUIN_CENTER_METRIC_KEY);

  const avatarLetter = emailInput.trim().charAt(0).toUpperCase() || '?';

  const closeAlert = () => {
    setAlertState(null);
  };

  const showInfoAlert = (title: string, message: string) => {
    setAlertState({
      title,
      message,
      actions: [{ label: 'OK' }],
    });
  };

  const persistEmail = async (normalizedEmail: string) => {
    try {
      setIsSavingEmail(true);
      const updatedUser = await api.updateMeEmail(normalizedEmail);
      setEmailInput(updatedUser.email);
      setSavedEmail(updatedUser.email);
      setPendingEmail(updatedUser.pending_email ?? null);
      updateCurrentUser(updatedUser);
      showInfoAlert(
        'Success',
        updatedUser.pending_email
          ? `Verification link sent to ${updatedUser.pending_email}`
          : 'Email updated successfully',
      );
    } catch (error) {
      showInfoAlert('Error', error instanceof Error ? error.message : 'Failed to update email');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleResendPendingEmailVerification = async () => {
    if (isInitialLoading || isSavingEmail || isResendingPendingEmail || !pendingEmail) {
      return;
    }

    try {
      setIsResendingPendingEmail(true);
      const response = await api.resendPendingEmailVerification();
      setPendingEmail(response.pending_email);
      showInfoAlert('Success', response.message);
    } catch (error) {
      showInfoAlert(
        'Error',
        error instanceof Error ? error.message : 'Failed to resend verification',
      );
    } finally {
      setIsResendingPendingEmail(false);
    }
  };

  const handleEmailChangeRequest = () => {
    if (isInitialLoading || isSavingEmail || alertState) {
      return;
    }

    const normalizedEmail = emailInput.trim().toLowerCase();
    const normalizedSavedEmail = savedEmail.trim().toLowerCase();
    if (normalizedEmail === normalizedSavedEmail) {
      return;
    }

    if (!normalizedEmail) {
      setEmailInput(savedEmail);
      showInfoAlert('Validation', 'Email is required');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setEmailInput(savedEmail);
      showInfoAlert('Validation', 'Enter a valid email');
      return;
    }

    setAlertState({
      title: 'Change email',
      message: 'Do you want to update your email?',
      actions: [
        {
          label: 'Cancel',
          variant: 'secondary',
          onPress: () => setEmailInput(savedEmail),
        },
        {
          label: 'Update',
          onPress: () => {
            void persistEmail(normalizedEmail);
          },
        },
      ],
    });
  };

  const handlePasswordChangeRequest = async () => {
    if (isInitialLoading || isSavingPassword || alertState) {
      return;
    }

    if (!currentPasswordInput) {
      showInfoAlert('Validation', 'Current password is required');
      return;
    }

    if (newPasswordInput.length < 8) {
      showInfoAlert('Validation', 'New password must be at least 8 characters');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      showInfoAlert('Validation', 'New password and confirmation do not match');
      return;
    }

    try {
      setIsSavingPassword(true);
      await api.updateMePassword(currentPasswordInput, newPasswordInput, confirmPasswordInput);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      showInfoAlert('Success', 'Password updated successfully');
    } catch (error) {
      showInfoAlert('Error', error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const creditBalanceLabel = subscription
    ? `${subscription.credits_balance} credits`
    : 'Unable to load balance';
  const creditPackages = subscription?.credit_packs?.length
    ? subscription.credit_packs
    : DEFAULT_CREDIT_PACKAGES;
  const selectedCreditPack =
    creditPackages.find((pack) => pack.code === selectedCreditPackageCode) ??
    creditPackages.find((pack) => pack.code === 'credits_50') ??
    creditPackages[0];
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const profileTabContent = (
    <>
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Email</Text>
        <View style={styles.emailRow}>
          <Avatar label={avatarLetter} style={styles.avatarFixed} />
          <TextField
            label=""
            containerStyle={styles.emailFieldContainer}
            value={emailInput}
            onChangeText={setEmailInput}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
            editable={!isInitialLoading && !isSavingEmail && !isResendingPendingEmail}
            onBlur={handleEmailChangeRequest}
            onSubmitEditing={handleEmailChangeRequest}
          />
        </View>
        {pendingEmail ? (
          <View style={styles.pendingEmailRow}>
            <Text style={styles.pendingEmailText}>
              Pending confirmation: {pendingEmail}
            </Text>
            <Button
              variant="secondary"
              style={styles.pendingEmailButton}
              onPress={() => {
                void handleResendPendingEmailVerification();
              }}
              loading={isResendingPendingEmail}
              disabled={isResendingPendingEmail}
            >
              Resend
            </Button>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionTitle>Change password</SectionTitle>
        <TextField
          label="Current password"
          value={currentPasswordInput}
          onChangeText={setCurrentPasswordInput}
          placeholder="Enter current password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isInitialLoading && !isSavingPassword}
        />
        <TextField
          label="New password"
          value={newPasswordInput}
          onChangeText={setNewPasswordInput}
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isInitialLoading && !isSavingPassword}
        />
        <TextField
          label="Confirm new password"
          value={confirmPasswordInput}
          onChangeText={setConfirmPasswordInput}
          placeholder="Repeat new password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isInitialLoading && !isSavingPassword}
        />
        <Button
          onPress={() => {
            void handlePasswordChangeRequest();
          }}
          loading={isSavingPassword}
          disabled={isInitialLoading || isSavingPassword}
        >
          Update password
        </Button>
      </View>
    </>
  );
  const mannequinTabContent = (
    <View style={styles.section}>
      {isDesktopWeb ? (
        <View style={styles.mannequinDesktopLayout}>
          <View style={styles.mannequinMetricColumn}>
            {mannequinLeftCards.map((card) => (
              <BodyMetricCard
                key={card.key}
                label={card.label}
                value={card.value}
                style={styles.mannequinOrbitCard}
              />
            ))}
          </View>
          <View style={styles.mannequinCenterColumn}>
            <View style={styles.mannequinFrame}>
              {mannequinImageUrl ? (
                <Image source={{ uri: mannequinImageUrl }} style={styles.mannequinImage} resizeMode="cover" />
              ) : isInitialLoading ? (
                <View style={styles.mannequinFallback}>
                  <ActivityIndicator color={uiColors.textOnLight} />
                </View>
              ) : (
                <View style={styles.mannequinFallback}>
                  <Text style={styles.mannequinFallbackText}>Generate mannequin to see preview</Text>
                </View>
              )}
            </View>
            {mannequinCenterCard ? (
              <BodyMetricCard
                key={mannequinCenterCard.key}
                label={mannequinCenterCard.label}
                value={mannequinCenterCard.value}
                style={[styles.mannequinOrbitCard, styles.mannequinCenterMetricCard]}
              />
            ) : null}
          </View>
          <View style={styles.mannequinMetricColumn}>
            {mannequinRightCards.map((card) => (
              <BodyMetricCard
                key={card.key}
                label={card.label}
                value={card.value}
                style={styles.mannequinOrbitCard}
              />
            ))}
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.mannequinFrameMobile}>
            {mannequinImageUrl ? (
              <Image source={{ uri: mannequinImageUrl }} style={styles.mannequinImage} resizeMode="cover" />
            ) : isInitialLoading ? (
              <View style={styles.mannequinFallback}>
                <ActivityIndicator color={uiColors.textOnLight} />
              </View>
            ) : (
              <View style={styles.mannequinFallback}>
                <Text style={styles.mannequinFallbackText}>Generate mannequin to see preview</Text>
              </View>
            )}
          </View>
          <View style={styles.metricsGrid}>
            {bodyMetricCards.map((card) => (
              <BodyMetricCard key={card.key} label={card.label} value={card.value} style={styles.metricCard} />
            ))}
          </View>
        </View>
      )}
      <Button
        variant="secondary"
        style={styles.editBodyButton}
        onPress={() => router.push('/onboarding')}
        disabled={isInitialLoading}
      >
        Edit body parameters
      </Button>
    </View>
  );
  const billingTabContent = (
    <View style={styles.section}>
      <View style={styles.subscriptionCard}>
        <View style={styles.subscriptionMain}>
          <View style={styles.planInfo}>
            <Text style={styles.planSubtitle}>Credits for virtual try-on</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceValue}>₸{formatKzt(selectedCreditPack.price_kzt)}</Text>
            <Text style={styles.priceSuffix}>/ {selectedCreditPack.credits} credits</Text>
          </View>

          <View style={styles.packageSelector}>
            {creditPackages.map((pack) => {
              const isSelected = pack.code === selectedCreditPack.code;

              return (
                <Pressable
                  key={pack.code}
                  onPress={() => setSelectedCreditPackageCode(pack.code)}
                  style={[styles.packageOption, isSelected && styles.packageOptionActive]}
                >
                  <Text style={[styles.packageCredits, isSelected && styles.packageCreditsActive]}>
                    {pack.credits}
                  </Text>
                  <Text style={[styles.packageUnit, isSelected && styles.packageUnitActive]}>credits</Text>
                  <Text style={[styles.packagePrice, isSelected && styles.packagePriceActive]}>
                    ₸{formatKzt(pack.price_kzt)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.balanceText}>Current balance: {creditBalanceLabel}</Text>

          <Button
            style={styles.billingCta}
            onPress={() => {
              void (async () => {
                try {
                  setIsBuyingCredits(true);
                  await Linking.openURL(TELEGRAM_PROFILE_URL);
                } catch (error) {
                  showInfoAlert('Error', error instanceof Error ? error.message : 'Failed to open Telegram profile');
                } finally {
                  setIsBuyingCredits(false);
                }
              })();
            }}
            loading={isBuyingCredits}
            disabled={isInitialLoading || isBuyingCredits}
          >
            Contact in Telegram
          </Button>
        </View>
      </View>
    </View>
  );

  let activeTabContent = profileTabContent;
  if (activeNavItem === 'Mannequin') {
    activeTabContent = mannequinTabContent;
  } else if (activeNavItem === 'Billing') {
    activeTabContent = billingTabContent;
  }

  return (
    <ScreenContainer
      maxWidth={1024}
      title='Settings'
      contentStyle={styles.screenContent}
    >
      {isDesktopWeb ? (
        <View style={styles.desktopLayout}>
          <View style={[styles.sidebar, webSidebarSticky]}>
            {SETTINGS_NAV_ITEMS.map((item) => {
              const isActive = item === activeNavItem;
              return (
                <Pressable
                  key={item}
                  onPress={() => setActiveNavItem(item)}
                  style={({ hovered }) => [
                    styles.sidebarItem,
                    webSidebarTransition,
                    isActive && styles.sidebarItemActive,
                    !isActive && hovered && styles.sidebarItemHover,
                    !isActive && hovered && styles.sidebarItemHoverLift,
                  ]}
                >
                  <Text style={[styles.sidebarItemText, isActive && styles.sidebarItemTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.mainContentDesktop}>
            <Text style={styles.pageTitle}>{activeNavItem}</Text>
            {activeTabContent}
          </View>
        </View>
      ) : (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mobileTabsContent}
            style={styles.mobileTabsScroll}
          >
            {SETTINGS_NAV_ITEMS.map((item) => {
              const isActive = item === activeNavItem;
              return (
                <Pressable
                  key={item}
                  onPress={() => setActiveNavItem(item)}
                  style={[styles.mobileTab, isActive && styles.mobileTabActive]}
                >
                  <Text style={[styles.mobileTabText, isActive && styles.mobileTabTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.pageTitle}>{activeNavItem}</Text>
          {activeTabContent}
        </View>
      )}

      <AlertModal
        visible={Boolean(alertState)}
        title={alertState?.title ?? ''}
        message={alertState?.message}
        actions={alertState?.actions ?? [{ label: 'OK' }]}
        onClose={closeAlert}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingTop: 28,
  },
  desktopLayout: {
    flexDirection: 'row',
    gap: 36,
    alignItems: 'flex-start',
  },
  sidebar: {
    width: 236,
    flexShrink: 0,
    paddingTop: 8,
  },
  sidebarItem: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  sidebarItemActive: {
    color: uiColors.textOnDark,
    backgroundColor: uiColors.textOnLight,
  },
  sidebarItemHover: {
    backgroundColor: 'rgba(17, 17, 17, 0.08)',
  },
  sidebarItemHoverLift: {
    transform: [{ scale: 1.01 }],
  },
  sidebarItemText: {
    fontSize: 14,
    fontWeight: '400',
    color: uiColors.textPrimary,
  },
  sidebarItemTextActive: {
    color: uiColors.surface,
  },
  mainContentDesktop: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    maxWidth: 780,
  },
  mobileTabsScroll: {
    marginBottom: 20,
  },
  mobileTabsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
    paddingRight: 24,
  },
  mobileTab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: uiColors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: uiColors.surface,
  },
  mobileTabActive: {
    backgroundColor: uiColors.textPrimary,
    borderColor: uiColors.textPrimary,
  },
  mobileTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: uiColors.textDark,
  },
  mobileTabTextActive: {
    color: uiColors.surface,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '500',
    color: uiColors.textPrimary,
    marginBottom: 16,
  },
  section: {
    marginBottom: 32,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: uiColors.textDark,
    marginBottom: 8,
  },
  emailRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarFixed: {
    flexShrink: 0,
  },
  emailFieldContainer: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    width: 0,
    marginBottom: 0,
  },
  pendingEmailRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pendingEmailText: {
    flex: 1,
    fontSize: 13,
    color: uiColors.textMuted,
    lineHeight: 18,
  },
  pendingEmailButton: {
    minWidth: 96,
  },
  subscriptionCard: {
    width: '100%',
    backgroundColor: uiColors.surface,
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    borderRadius: 22,
    overflow: 'hidden',
  },
  subscriptionMain: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  planInfo: {
    marginTop: 4,
  },
  planTitle: {
    fontSize: 50,
    lineHeight: 50,
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: uiColors.textPrimary,
  },
  planSubtitle: {
    marginTop: 8,
    fontSize: 18,
    color: uiColors.textSecondary,
  },
  priceRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceValue: {
    fontSize: 46,
    lineHeight: 48,
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: uiColors.textPrimary,
  },
  priceSuffix: {
    fontSize: 22,
    lineHeight: 30,
    color: uiColors.textSecondary,
    marginBottom: 4,
  },
  balanceText: {
    marginTop: 8,
    fontSize: 12,
    color: uiColors.textMuted,
  },
  balanceHint: {
    marginTop: 4,
    fontSize: 13,
    color: uiColors.textSecondary,
  },
  packageSelector: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  packageOption: {
    flexBasis: 160,
    flexGrow: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    borderRadius: 18,
    backgroundColor: uiColors.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  packageOptionActive: {
    backgroundColor: uiColors.textPrimary,
    borderColor: uiColors.textPrimary,
  },
  packageCredits: {
    fontSize: 28,
    lineHeight: 30,
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: uiColors.textPrimary,
  },
  packageCreditsActive: {
    color: uiColors.surface,
  },
  packageUnit: {
    fontSize: 13,
    color: uiColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  packageUnitActive: {
    color: 'rgba(255,255,255,0.72)',
  },
  packagePrice: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600',
    color: uiColors.textDark,
  },
  packagePriceActive: {
    color: uiColors.surface,
  },
  billingCta: {
    width: '100%',
    marginTop: 20,
    borderRadius: 16,
    paddingVertical: 14,
  },
  planDivider: {
    borderTopWidth: 1,
    borderTopColor: uiColors.borderSoft,
  },
  featuresBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 10,
  },
  featuresTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: uiColors.textPrimary,
    marginBottom: 2,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureCheck: {
    fontSize: 16,
    color: uiColors.textSecondary,
    width: 14,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 16,
    color: uiColors.textDark,
    flexShrink: 1,
  },
  mannequinDesktopLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 10,
  },
  mannequinMetricColumn: {
    flex: 1,
    maxWidth: 188,
    gap: 10,
  },
  mannequinCenterColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  mannequinFrame: {
    width: '100%',
    height: 430,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    backgroundColor: uiColors.surface,
  },
  mannequinFrameMobile: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    height: 430,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    backgroundColor: uiColors.surface,
    marginBottom: 14,
  },
  mannequinImage: {
    width: '100%',
    height: '100%',
  },
  mannequinFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  mannequinFallbackText: {
    fontSize: 14,
    color: uiColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  mannequinOrbitCard: {
    width: '100%',
    minHeight: 90,
  },
  mannequinCenterMetricCard: {
    minHeight: 84,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 170,
    minHeight: 88,
  },
  editBodyButton: {
    marginTop: 14,
  },
});
