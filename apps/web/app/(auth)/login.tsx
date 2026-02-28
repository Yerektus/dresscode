import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@repo/ui/button';
import { ScreenContainer } from '@repo/ui/screen-container';
import { TextField } from '@repo/ui/text-field';
import { TextLink } from '@repo/ui/text-link';
import * as api from '@/services/api';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, getPostAuthRoute } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showResend, setShowResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleLogin = async () => {
    try {
      await signIn(email, password);
      setShowResend(false);
      const route = await getPostAuthRoute();
      router.replace(route);
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 403 && e.message.includes('Email is not verified')) {
        setShowResend(true);
      } else {
        setShowResend(false);
      }

      alert(e instanceof Error ? e.message : 'Login failed');
    }
  };

  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      alert('Enter your email first');
      return;
    }

    try {
      setIsResending(true);
      await api.resendVerification(normalizedEmail);
      alert('If account exists, verification email sent');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to resend verification');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <ScreenContainer
      scroll={false}
      centerContent
      maxWidth={512}
      title="Welcome back"
      subtitle="Sign in to your account"
    >
      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />
        <Button style={styles.cta} onPress={handleLogin}>
          Sign In
        </Button>
        {showResend ? (
          <Button
            variant="secondary"
            style={styles.secondaryCta}
            onPress={() => {
              void handleResendVerification();
            }}
            loading={isResending}
            disabled={isResending}
          >
            Resend verification
          </Button>
        ) : null}
        <TextLink align="center" onPress={() => router.push('/(auth)/register')}>
          No account yet? Register
        </TextLink>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
  },
  cta: {
    marginTop: 8,
    marginBottom: 12,
  },
  secondaryCta: {
    marginBottom: 20,
  },
});
