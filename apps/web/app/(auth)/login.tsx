import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@repo/ui/button';
import { ScreenContainer } from '@repo/ui/screen-container';
import { TextField } from '@repo/ui/text-field';
import { TextLink } from '@repo/ui/text-link';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, getPostAuthRoute } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await signIn(email, password);
      const route = await getPostAuthRoute();
      router.replace(route);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Login failed');
    }
  };

  return (
    <ScreenContainer
      scroll={false}
      centerContent
      maxWidth={400}
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
    marginBottom: 20,
  },
});
