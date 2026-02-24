import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@repo/ui/button';
import { ScreenContainer } from '@repo/ui/screen-container';
import { TextField } from '@repo/ui/text-field';
import { TextLink } from '@repo/ui/text-link';
import { useAuth } from '@/providers/auth-provider';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, getPostAuthRoute } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegister = async () => {
    try {
      await signUp(email, password, confirmPassword);
      const route = await getPostAuthRoute();
      router.replace(route);
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
  form: {
    width: '100%',
  },
  cta: {
    marginTop: 8,
    marginBottom: 20,
  },
});
