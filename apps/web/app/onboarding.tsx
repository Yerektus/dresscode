import { Image, View, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Button } from '@repo/ui/button';
import { ScreenContainer } from '@repo/ui/screen-container';
import { SectionTitle } from '@repo/ui/section-title';
import { WheelPicker, type WheelPickerOption } from '@repo/ui/wheel-picker';
import * as api from '@/services/api';
import { useAuth } from '@/providers/auth-provider';

function buildRangeOptions(start: number, end: number): WheelPickerOption[] {
  const options: WheelPickerOption[] = [];
  for (let value = start; value <= end; value += 1) {
    const textValue = String(value);
    options.push({ label: textValue, value: textValue });
  }
  return options;
}

function buildOptionalRangeOptions(start: number, end: number): WheelPickerOption[] {
  return [{ label: '—', value: '' }, ...buildRangeOptions(start, end)];
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const heightOptions = useMemo(() => buildRangeOptions(140, 220), []);
  const weightOptions = useMemo(() => buildRangeOptions(35, 180), []);
  const chestOptions = useMemo(() => buildOptionalRangeOptions(70, 150), []);
  const waistOptions = useMemo(() => buildOptionalRangeOptions(50, 140), []);
  const hipsOptions = useMemo(() => buildOptionalRangeOptions(70, 160), []);
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('70');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleHeightChange = (nextValue: string) => {
    setHeight(nextValue);
    setGeneratedImageUrl(null);
  };

  const handleWeightChange = (nextValue: string) => {
    setWeight(nextValue);
    setGeneratedImageUrl(null);
  };

  const handleChestChange = (nextValue: string) => {
    setChest(nextValue);
    setGeneratedImageUrl(null);
  };

  const handleWaistChange = (nextValue: string) => {
    setWaist(nextValue);
    setGeneratedImageUrl(null);
  };

  const handleHipsChange = (nextValue: string) => {
    setHips(nextValue);
    setGeneratedImageUrl(null);
  };

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const handleContinue = async () => {
    if (isGenerating) {
      return;
    }

    const parsedHeight = Number.parseFloat(height);
    const parsedWeight = Number.parseFloat(weight);

    if (!Number.isFinite(parsedHeight) || parsedHeight <= 0) {
      alert('Enter a valid height in cm');
      return;
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      alert('Enter a valid weight in kg');
      return;
    }

    try {
      setIsGenerating(true);
      await api.saveBodyProfile({
        height_cm: parsedHeight,
        weight_kg: parsedWeight,
        ...(chest ? { chest_cm: parseFloat(chest) } : {}),
        ...(waist ? { waist_cm: parseFloat(waist) } : {}),
        ...(hips ? { hips_cm: parseFloat(hips) } : {}),
      });
      const generatedMannequin = await api.generateMannequin();
      setGeneratedImageUrl(generatedMannequin.front_image_url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScreenContainer
      title="Set up your body profile"
      subtitle="We'll use this to generate your personalized mannequin and size recommendations."
      maxWidth={640}
      centerContent
    >
      <SectionTitle variant="muted">Required</SectionTitle>
      <View style={styles.row}>
        <View style={styles.pickerField}>
          <WheelPicker
            label="Height (cm)"
            options={heightOptions}
            value={height}
            onChange={handleHeightChange}
          />
        </View>
        <View style={styles.pickerField}>
          <WheelPicker
            label="Weight (kg)"
            options={weightOptions}
            value={weight}
            onChange={handleWeightChange}
          />
        </View>
      </View>

      <SectionTitle variant="muted">Optional (improves accuracy)</SectionTitle>
      <View style={styles.row}>
        <View style={styles.pickerField}>
          <WheelPicker
            label="Chest (cm)"
            options={chestOptions}
            value={chest}
            onChange={handleChestChange}
          />
        </View>
        <View style={styles.pickerField}>
          <WheelPicker
            label="Waist (cm)"
            options={waistOptions}
            value={waist}
            onChange={handleWaistChange}
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.pickerField}>
          <WheelPicker
            label="Hips (cm)"
            options={hipsOptions}
            value={hips}
            onChange={handleHipsChange}
          />
        </View>
        <View style={styles.pickerField} />
      </View>

      <Button style={styles.cta} onPress={handleContinue}>
        {isGenerating
          ? 'Generating cinematic photo...'
          : generatedImageUrl
            ? 'Regenerate cinematic photo'
            : 'Generate cinematic full-body photo'}
      </Button>

      {generatedImageUrl ? (
        <View style={styles.previewSection}>
          <SectionTitle variant="muted">Generated preview</SectionTitle>
          <View style={styles.previewFrame}>
            <Image
              source={{ uri: generatedImageUrl }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          </View>
          <Button variant="secondary" style={styles.continueButton} onPress={() => router.replace('/(tabs)')}>
            Continue to app
          </Button>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  pickerField: {
    flex: 1,
  },
  cta: {
    marginTop: 16,
    marginBottom: 12,
  },
  previewSection: {
    width: '100%',
    marginTop: 8,
  },
  previewFrame: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    height: 620,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  continueButton: {
    marginTop: 14,
  },
});
