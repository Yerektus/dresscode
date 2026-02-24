import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@repo/ui/button';
import { PlanCard } from '@repo/ui/plan-card';
import { ScreenContainer } from '@repo/ui/screen-container';
import { SectionTitle } from '@repo/ui/section-title';
import { TextLink } from '@repo/ui/text-link';
import { uiColors } from '@repo/ui/colors';
import { useAuth } from '@/providers/auth-provider';
import * as api from '@/services/api';

interface BodyMetricCard {
  key: string;
  label: string;
  value: string;
}

const MISSING_VALUE = '—';

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

function formatPlanName(planCode: string): string {
  return toTitleCase(planCode);
}

function formatSubscriptionDetail(subscription: api.SubscriptionResponse): string {
  const statusText = toTitleCase(subscription.status);
  if (!subscription.current_period_end) {
    return statusText;
  }

  const parsedDate = new Date(subscription.current_period_end);
  if (Number.isNaN(parsedDate.getTime())) {
    return `${statusText} · ${subscription.current_period_end}`;
  }

  return `${statusText} · until ${parsedDate.toLocaleDateString()}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut, updateCurrentUser } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [bodyProfile, setBodyProfile] = useState<api.BodyProfileResponse | null>(null);
  const [subscription, setSubscription] = useState<api.SubscriptionResponse | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProfileData = async () => {
      setIsInitialLoading(true);

      const [meResult, bodyResult, subscriptionResult] = await Promise.allSettled([
        api.getMe(),
        api.getBodyProfile(),
        api.getSubscription(),
      ]);

      if (!active) {
        return;
      }

      if (meResult.status === 'fulfilled') {
        setEmailInput(meResult.value.email);
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

      setIsInitialLoading(false);
    };

    void loadProfileData();

    return () => {
      active = false;
    };
  }, [updateCurrentUser]);

  const bodyMetricCards = useMemo<BodyMetricCard[]>(
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

  const avatarLetter = emailInput.trim().charAt(0).toUpperCase() || '?';

  const handleSaveEmail = async () => {
    if (isInitialLoading || isSavingEmail) {
      return;
    }

    const normalizedEmail = emailInput.trim().toLowerCase();
    if (!normalizedEmail) {
      alert('Email is required');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      alert('Enter a valid email');
      return;
    }

    try {
      setIsSavingEmail(true);
      const updatedUser = await api.updateMeEmail(normalizedEmail);
      setEmailInput(updatedUser.email);
      updateCurrentUser(updatedUser);
      alert('Email updated successfully');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update email');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    router.replace('/(auth)/login');
  };

  const planName = subscription ? formatPlanName(subscription.plan_code) : 'Plan unavailable';
  const planDetail = subscription
    ? formatSubscriptionDetail(subscription)
    : 'Unable to load subscription';

  return (
    <ScreenContainer title="Profile">
      <View style={styles.section}>
        <SectionTitle>Account</SectionTitle>
        <Text style={styles.fieldLabel}>Email</Text>
        <View style={styles.emailRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <TextInput
            style={styles.emailInput}
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isInitialLoading && !isSavingEmail}
            placeholderTextColor={uiColors.textHint}
          />
        </View>
        <Button
          style={styles.saveEmailButton}
          onPress={handleSaveEmail}
          loading={isSavingEmail}
          disabled={isInitialLoading || !emailInput.trim()}
        >
          Save email
        </Button>
      </View>

      <View style={styles.section}>
        <SectionTitle>Body information</SectionTitle>
        <View style={styles.metricsGrid}>
          {bodyMetricCards.map((card) => (
            <View key={card.key} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{card.label}</Text>
              <Text style={styles.metricValue}>{card.value}</Text>
            </View>
          ))}
        </View>
        <Button
          variant="secondary"
          style={styles.editBodyButton}
          onPress={() => router.push('/onboarding')}
          disabled={isInitialLoading}
        >
          Edit body parameters
        </Button>
      </View>

      <View style={styles.section}>
        <SectionTitle>Subscription</SectionTitle>
        <PlanCard name={planName} detail={planDetail} />
        <Button variant="secondary" disabled={isInitialLoading}>
          Upgrade to Premium
        </Button>
      </View>

      <TextLink
        tone="danger"
        align="center"
        pressableStyle={[styles.logoutButton, isInitialLoading && styles.disabledAction]}
        onPress={isInitialLoading ? undefined : handleSignOut}
      >
        Sign Out
      </TextLink>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: uiColors.textDark,
    marginBottom: 10,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: uiColors.surfaceSoft,
    borderWidth: 1,
    borderColor: uiColors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '600',
    color: uiColors.textOnLight,
  },
  emailInput: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: uiColors.borderStrong,
    borderRadius: 14,
    backgroundColor: uiColors.surface,
    color: uiColors.textPrimary,
    paddingHorizontal: 16,
    fontSize: 18,
  },
  saveEmailButton: {
    marginTop: 14,
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
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: uiColors.surface,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: uiColors.textMuted,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '600',
    color: uiColors.textPrimary,
  },
  editBodyButton: {
    marginTop: 14,
  },
  logoutButton: {
    marginTop: 8,
  },
  disabledAction: {
    opacity: 0.5,
  },
});
