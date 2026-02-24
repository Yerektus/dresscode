import { View, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@repo/ui/button';
import { ScreenContainer } from '@repo/ui/screen-container';
import { SectionTitle } from '@repo/ui/section-title';
import { TextLink } from '@repo/ui/text-link';
import { WheelPicker, type WheelPickerOption } from '@repo/ui/wheel-picker';
import * as api from '@/services/api';
import { useAuth } from '@/providers/auth-provider';

type BodyGender = 'female' | 'male';
type BodyShape = api.BodyShape;
type BodyShapePickerValue = BodyShape | '';
const BODY_SHAPE_VALUES: BodyShape[] = ['hourglass', 'pear', 'apple', 'rectangle', 'inverted_triangle'];

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

function parseNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function resolveNumericPickerValue(
  value: unknown,
  options: WheelPickerOption[],
  fallbackValue: string,
): string {
  const parsedValue = parseNumericValue(value);
  if (parsedValue === null) {
    return fallbackValue;
  }

  const numericOptions = options
    .map((option) => Number.parseInt(option.value, 10))
    .filter((optionValue) => Number.isFinite(optionValue));

  if (numericOptions.length === 0) {
    return fallbackValue;
  }

  const target = Math.round(parsedValue);
  let closestOption = numericOptions[0] ?? Number.parseInt(fallbackValue, 10);
  let minDistance = Math.abs(target - closestOption);

  for (const optionValue of numericOptions) {
    const distance = Math.abs(target - optionValue);
    if (distance < minDistance) {
      closestOption = optionValue;
      minDistance = distance;
    }
  }

  return String(closestOption);
}

function resolveTextPickerValue(
  value: string | null | undefined,
  options: WheelPickerOption[],
  fallbackValue: string,
): string {
  if (!value) {
    return fallbackValue;
  }

  return options.some((option) => option.value === value) ? value : fallbackValue;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const heightOptions = useMemo(() => buildRangeOptions(140, 220), []);
  const weightOptions = useMemo(() => buildRangeOptions(35, 180), []);
  const chestOptions = useMemo(() => buildOptionalRangeOptions(70, 150), []);
  const waistOptions = useMemo(() => buildOptionalRangeOptions(50, 140), []);
  const hipsOptions = useMemo(() => buildOptionalRangeOptions(70, 160), []);
  const sleeveOptions = useMemo(() => buildOptionalRangeOptions(45, 90), []);
  const inseamOptions = useMemo(() => buildOptionalRangeOptions(55, 120), []);
  const genderOptions = useMemo<WheelPickerOption[]>(
    () => [
      { label: 'Female', value: 'female' },
      { label: 'Male', value: 'male' },
    ],
    [],
  );
  const bodyShapeOptions = useMemo<WheelPickerOption[]>(
    () => [
      { label: '—', value: '' },
      { label: 'Hourglass', value: 'hourglass' },
      { label: 'Pear', value: 'pear' },
      { label: 'Apple', value: 'apple' },
      { label: 'Rectangle', value: 'rectangle' },
      { label: 'Inverted triangle', value: 'inverted_triangle' },
    ],
    [],
  );
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('70');
  const [gender, setGender] = useState<BodyGender>('female');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [sleeve, setSleeve] = useState('');
  const [inseam, setInseam] = useState('');
  const [bodyShape, setBodyShape] = useState<BodyShapePickerValue>('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let active = true;

    const hydrateExistingBodyProfile = async () => {
      try {
        const existingBodyProfile = await api.getBodyProfile();

        if (!active) {
          return;
        }

        if (existingBodyProfile.gender === 'female' || existingBodyProfile.gender === 'male') {
          setGender(existingBodyProfile.gender);
        }

        setHeight(resolveNumericPickerValue(existingBodyProfile.height_cm, heightOptions, '170'));
        setWeight(resolveNumericPickerValue(existingBodyProfile.weight_kg, weightOptions, '70'));
        setChest(resolveNumericPickerValue(existingBodyProfile.chest_cm, chestOptions, ''));
        setWaist(resolveNumericPickerValue(existingBodyProfile.waist_cm, waistOptions, ''));
        setHips(resolveNumericPickerValue(existingBodyProfile.hips_cm, hipsOptions, ''));
        setSleeve(resolveNumericPickerValue(existingBodyProfile.sleeve_cm, sleeveOptions, ''));
        setInseam(resolveNumericPickerValue(existingBodyProfile.inseam_cm, inseamOptions, ''));
        setBodyShape(
          resolveTextPickerValue(existingBodyProfile.body_shape, bodyShapeOptions, '') as BodyShapePickerValue,
        );
      } catch (error) {
        if (!(error instanceof api.ApiError && error.status === 404)) {
          console.error('Failed to preload body profile for onboarding', error);
        }
      }
    };

    void hydrateExistingBodyProfile();

    return () => {
      active = false;
    };
  }, [
    isAuthenticated,
    bodyShapeOptions,
    chestOptions,
    heightOptions,
    hipsOptions,
    inseamOptions,
    sleeveOptions,
    waistOptions,
    weightOptions,
  ]);

  const handleHeightChange = (nextValue: string) => {
    setHeight(nextValue);
  };

  const handleWeightChange = (nextValue: string) => {
    setWeight(nextValue);
  };

  const handleGenderChange = (nextValue: string) => {
    if (nextValue === 'female' || nextValue === 'male') {
      setGender(nextValue);
    }
  };

  const handleChestChange = (nextValue: string) => {
    setChest(nextValue);
  };

  const handleWaistChange = (nextValue: string) => {
    setWaist(nextValue);
  };

  const handleHipsChange = (nextValue: string) => {
    setHips(nextValue);
  };

  const handleSleeveChange = (nextValue: string) => {
    setSleeve(nextValue);
  };

  const handleInseamChange = (nextValue: string) => {
    setInseam(nextValue);
  };

  const handleBodyShapeChange = (nextValue: string) => {
    if (nextValue === '' || BODY_SHAPE_VALUES.includes(nextValue as BodyShape)) {
      setBodyShape(nextValue as BodyShapePickerValue);
    }
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
        gender,
        ...(chest ? { chest_cm: parseFloat(chest) } : {}),
        ...(waist ? { waist_cm: parseFloat(waist) } : {}),
        ...(hips ? { hips_cm: parseFloat(hips) } : {}),
        ...(sleeve ? { sleeve_cm: parseFloat(sleeve) } : {}),
        ...(inseam ? { inseam_cm: parseFloat(inseam) } : {}),
        ...(bodyShape ? { body_shape: bodyShape } : {}),
      });
      const generatedMannequin = await api.generateMannequin();
      router.replace({
        pathname: '/onboarding-result',
        params: { imageUrl: generatedMannequin.front_image_url },
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScreenContainer
      leading={
        <TextLink onPress={() => router.back()} style={styles.backLink}>
          ← Back
        </TextLink>
      }
      title="Set up your body profile"
      subtitle="We'll use this to generate your personalized mannequin and size recommendations."
      maxWidth={640}
      centerContent
    >
      <SectionTitle variant="muted">Required</SectionTitle>
      <View style={styles.row}>
        <View style={styles.pickerField}>
          <WheelPicker
            label="Gender"
            options={genderOptions}
            value={gender}
            onChange={handleGenderChange}
          />
        </View>
        <View style={styles.pickerField}>
          <WheelPicker
            label="Height (cm)"
            options={heightOptions}
            value={height}
            onChange={handleHeightChange}
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.pickerField}>
          <WheelPicker
            label="Weight (kg)"
            options={weightOptions}
            value={weight}
            onChange={handleWeightChange}
          />
        </View>
        <View style={styles.pickerField} />
      </View>

      <SectionTitle variant="muted">Optional</SectionTitle>
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
        <View style={styles.pickerField}>
          <WheelPicker
            label="Sleeve (cm)"
            options={sleeveOptions}
            value={sleeve}
            onChange={handleSleeveChange}
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.pickerField}>
          <WheelPicker
            label="Inseam (cm)"
            options={inseamOptions}
            value={inseam}
            onChange={handleInseamChange}
          />
        </View>
        <View style={styles.pickerField}>
          <WheelPicker
            label="Body shape"
            options={bodyShapeOptions}
            value={bodyShape}
            onChange={handleBodyShapeChange}
          />
        </View>
      </View>

      <Button style={styles.cta} onPress={handleContinue} loading={isGenerating}>
        {isGenerating ? 'Generating mannequin...' : 'Generate mannequin'}
      </Button>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backLink: {
    marginBottom: 12,
    fontSize: 15,
    fontWeight: '500',
  },
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
});
