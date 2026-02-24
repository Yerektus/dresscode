import { View, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@repo/ui/button';
import { ScreenContainer } from '@repo/ui/screen-container';
import { SectionTitle } from '@repo/ui/section-title';
import { TextField } from '@repo/ui/text-field';
import { TextLink } from '@repo/ui/text-link';
import * as api from '@/services/api';
import { useAuth } from '@/providers/auth-provider';

export default function OnboardingScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const handleContinue = async () => {
    try {
      await api.saveBodyProfile({
        height_cm: parseFloat(height),
        weight_kg: parseFloat(weight),
        ...(chest ? { chest_cm: parseFloat(chest) } : {}),
        ...(waist ? { waist_cm: parseFloat(waist) } : {}),
        ...(hips ? { hips_cm: parseFloat(hips) } : {}),
      });
      await api.generateMannequin();
      router.replace('/(tabs)');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save profile');
    }
  };

  return (
    <ScreenContainer
      title="Set up your body profile"
      subtitle="We'll use this to generate your personalized mannequin and size recommendations."
      maxWidth={500}
      centerContent
    >
      <SectionTitle variant="muted">Required</SectionTitle>
      <View style={styles.row}>
        <View style={styles.halfField}>
          <TextField
            label="Height (cm)"
            value={height}
            onChangeText={setHeight}
            keyboardType="numeric"
            placeholder="175"
          />
        </View>
        <View style={styles.halfField}>
          <TextField
            label="Weight (kg)"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            placeholder="70"
          />
        </View>
      </View>

      <SectionTitle variant="muted">Optional (improves accuracy)</SectionTitle>
      <View style={styles.row}>
        <View style={styles.halfField}>
          <TextField
            label="Chest (cm)"
            value={chest}
            onChangeText={setChest}
            keyboardType="numeric"
            placeholder="—"
          />
        </View>
        <View style={styles.halfField}>
          <TextField
            label="Waist (cm)"
            value={waist}
            onChangeText={setWaist}
            keyboardType="numeric"
            placeholder="—"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.halfField}>
          <TextField
            label="Hips (cm)"
            value={hips}
            onChangeText={setHips}
            keyboardType="numeric"
            placeholder="—"
          />
        </View>
        <View style={styles.halfField} />
      </View>

      <Button style={styles.cta} onPress={handleContinue}>
        Generate Mannequin
      </Button>
      <TextLink tone="muted" align="center" onPress={() => router.replace('/(tabs)')}>
        Skip for now
      </TextLink>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 2,
  },
  halfField: {
    flex: 1,
  },
  cta: {
    marginTop: 16,
    marginBottom: 12,
  },
});
