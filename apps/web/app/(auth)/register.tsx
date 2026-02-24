import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@repo/ui/button';
import { uiColors } from '@repo/ui/colors';
import { ScreenContainer } from '@repo/ui/screen-container';
import { TextField } from '@repo/ui/text-field';
import { TextLink } from '@repo/ui/text-link';
import * as api from '@/services/api';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegister = async () => {
    try {
      const res = await api.register(email, password, confirmPassword);
      api.setAuthToken(res.access_token);
      router.replace('/onboarding');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Registration failed');
    }
  };

  return (
    <ScreenContainer
      scroll={false}
      centerContent
      maxWidth={400}
      title="Create account"
      subtitle="Start your virtual try-on journey"
      leading={
        <TextLink onPress={() => router.back()} style={styles.backText}>
          ← Back
        </TextLink>
      }
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
        <TextField
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
          secureTextEntry
        />
        <Button style={styles.cta} onPress={handleRegister}>
          Create Account
        </Button>
        <TextLink align="center" onPress={() => router.push('/(auth)/login')}>
          Already have an account? Sign in
        </TextLink>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backText: {
    fontSize: 15,
    color: uiColors.textSecondary,
  },
  form: {
    width: '100%',
  },
  cta: {
    marginTop: 8,
    marginBottom: 20,
  },
});
