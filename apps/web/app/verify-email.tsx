import { useEffect, useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@repo/ui/button';
import { ScreenContainer } from '@repo/ui/screen-container';
import { uiColors } from '@repo/ui/colors';
import * as api from '@/services/api';
import { useAuth } from '@/providers/auth-provider';

function resolveTokenParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' && first.trim() ? first.trim() : null;
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return null;
}

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => resolveTokenParam(params.token), [params.token]);
  const { applySession, getPostAuthRoute } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!token) {
        setErrorMessage('Verification token is missing');
        setIsVerifying(false);
        return;
      }

      try {
        const session = await api.verifyEmail(token);
        if (!active) {
          return;
        }

        applySession(session);
        const route = await getPostAuthRoute();
        if (!active) {
          return;
        }

        router.replace(route);
      } catch (error) {
        if (!active) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Failed to verify email');
      } finally {
        if (active) {
          setIsVerifying(false);
        }
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [applySession, getPostAuthRoute, router, token]);

  return (
    <ScreenContainer
      centerContent
      maxWidth={520}
      title="Email verification"
      subtitle={isVerifying ? 'Verifying your email...' : 'Verification status'}
    >
      <View style={styles.card}>
        {isVerifying ? (
          <Text style={styles.message}>Please wait while we verify your email.</Text>
        ) : errorMessage ? (
          <>
            <Text style={styles.error}>{errorMessage}</Text>
            <Button
              style={styles.cta}
              onPress={() => router.replace('/(auth)/login')}
            >
              Back to login
            </Button>
          </>
        ) : (
          <>
            <Text style={styles.message}>Email verified successfully. Redirecting...</Text>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: uiColors.surface,
  },
  message: {
    fontSize: 15,
    color: uiColors.textPrimary,
    lineHeight: 22,
  },
  error: {
    fontSize: 15,
    color: uiColors.danger,
    lineHeight: 22,
  },
  cta: {
    marginTop: 12,
  },
});
