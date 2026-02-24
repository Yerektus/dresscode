import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as api from '@/services/api';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const res = await api.login(email, password);
      api.setAuthToken(res.access_token);
      router.replace('/(tabs)');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Login failed');
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <View style={styles.form}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
        </View>

        <Pressable style={styles.cta} onPress={handleLogin}>
          <Text style={styles.ctaText}>Sign In</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.link}>Don't have an account? Register</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  back: {
    padding: 24,
  },
  backText: {
    fontSize: 15,
    color: '#555',
  },
  form: {
    flex: 1,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    ...(Platform.OS === 'web' ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}),
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  cta: {
    backgroundColor: '#111',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    color: '#555',
    fontSize: 14,
  },
});
