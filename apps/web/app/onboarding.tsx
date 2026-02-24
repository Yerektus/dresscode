import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as api from '@/services/api';

export default function OnboardingScreen() {
  const router = useRouter();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set up your body profile</Text>
      <Text style={styles.subtitle}>
        We'll use this to generate your personalized mannequin and size recommendations.
      </Text>

      <Text style={styles.sectionLabel}>Required</Text>
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Height (cm)</Text>
          <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="175" />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="70" />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Optional (improves accuracy)</Text>
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Chest (cm)</Text>
          <TextInput style={styles.input} value={chest} onChangeText={setChest} keyboardType="numeric" placeholder="—" />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Waist (cm)</Text>
          <TextInput style={styles.input} value={waist} onChangeText={setWaist} keyboardType="numeric" placeholder="—" />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Hips (cm)</Text>
          <TextInput style={styles.input} value={hips} onChangeText={setHips} keyboardType="numeric" placeholder="—" />
        </View>
        <View style={styles.halfField} />
      </View>

      <Pressable style={styles.cta} onPress={handleContinue}>
        <Text style={styles.ctaText}>Generate Mannequin</Text>
      </Pressable>

      <Pressable onPress={() => router.replace('/(tabs)')} style={styles.skip}>
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  content: {
    padding: 24,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'center',
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
    ...(Platform.OS === 'web' ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}),
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    lineHeight: 24,
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  halfField: {
    flex: 1,
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
    marginTop: 16,
    marginBottom: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skip: {
    alignItems: 'center',
    padding: 8,
  },
  skipText: {
    color: '#999',
    fontSize: 14,
  },
});
