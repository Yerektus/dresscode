import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Button } from '@repo/ui/button';
import { uiColors } from '@repo/ui/colors';
import { ScreenContainer } from '@repo/ui/screen-container';
import { SectionTitle } from '@repo/ui/section-title';
import { TextField } from '@repo/ui/text-field';
import { UploadZone } from '@repo/ui/upload-zone';
import * as ImagePicker from 'expo-image-picker';
import * as api from '@/services/api';
import { uploadImageAssetWithPresign } from '@/services/media-upload';

type TryOnSize = api.CreateTryOnRequestDto['selected_size'];

function asDataUri(asset: ImagePicker.ImagePickerAsset): string | null {
  if (!asset.base64) {
    return null;
  }

  const mimeType = asset.mimeType ?? 'image/jpeg';
  return `data:${mimeType};base64,${asset.base64}`;
}

export default function TryOnScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [size, setSize] = useState<TryOnSize>('M');
  const [waistInput, setWaistInput] = useState('');
  const [chestInput, setChestInput] = useState('');
  const [hipsInput, setHipsInput] = useState('');
  const [garmentImageUri, setGarmentImageUri] = useState<string | null>(null);
  const [garmentImageDataUri, setGarmentImageDataUri] = useState<string | null>(null);
  const [garmentImageAsset, setGarmentImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [garmentImageAssetKey, setGarmentImageAssetKey] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isTryingOn, setIsTryingOn] = useState(false);
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;

  const sizes: TryOnSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const canTryOn = Boolean(garmentImageUri || garmentImageAssetKey) && !isPickingImage && !isTryingOn;
  const sanitizeMeasurementInput = (value: string) => {
    const normalized = value.replace(',', '.');
    let sanitized = normalized.replace(/[^0-9.]/g, '');
    const dotIndex = sanitized.indexOf('.');
    if (dotIndex >= 0) {
      sanitized =
        sanitized.slice(0, dotIndex + 1) + sanitized.slice(dotIndex + 1).replace(/\./g, '');
    }
    return sanitized;
  };
  const parseMeasurementInput = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return Math.round(parsed * 10) / 10;
  };

  useEffect(() => {
    let active = true;
    const loadBodyProfile = async () => {
      try {
        const profile = await api.getBodyProfile();
        if (active) {
          setWaistInput(
            Number.isFinite(profile.waist_cm) ? String(Math.round(Number(profile.waist_cm))) : '',
          );
          setChestInput(
            Number.isFinite(profile.chest_cm) ? String(Math.round(Number(profile.chest_cm))) : '',
          );
          setHipsInput(
            Number.isFinite(profile.hips_cm) ? String(Math.round(Number(profile.hips_cm))) : '',
          );
        }
      } catch {
        // Keep fields empty when body profile is unavailable.
      }
    };

    void loadBodyProfile();

    return () => {
      active = false;
    };
  }, []);

  const handlePickImage = async () => {
    if (isPickingImage || isTryingOn) {
      return;
    }

    try {
      setIsPickingImage(true);

      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          alert('Allow photo library access to upload an image');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const nextAsset = result.assets[0];
      const nextUri = nextAsset?.uri ?? null;
      const dataUri = nextAsset ? asDataUri(nextAsset) : null;

      if (!nextUri) {
        alert('Failed to process selected image. Try another one.');
        return;
      }

      setGarmentImageUri(nextUri);
      setGarmentImageDataUri(dataUri);
      setGarmentImageAsset(nextAsset);
      setGarmentImageAssetKey(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to pick image');
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleTryOn = async () => {
    if ((!garmentImageUri && !garmentImageAssetKey && !garmentImageDataUri) || isTryingOn || isPickingImage) {
      return;
    }

    try {
      setIsTryingOn(true);
      let uploadedGarmentAssetKey = garmentImageAssetKey;

      if (garmentImageAsset && !uploadedGarmentAssetKey) {
        try {
          uploadedGarmentAssetKey = await uploadImageAssetWithPresign(garmentImageAsset, 'garment_image');
          setGarmentImageAssetKey(uploadedGarmentAssetKey);
        } catch (uploadError) {
          console.warn('Garment image upload via presign failed; fallback to legacy payload', uploadError);
        }
      }

      const persistedLegacyGarmentImage =
        garmentImageDataUri ??
        (garmentImageUri && (garmentImageUri.startsWith('https://') || garmentImageUri.startsWith('data:'))
          ? garmentImageUri
          : null);

      if (!uploadedGarmentAssetKey && !persistedLegacyGarmentImage) {
        throw new Error('Failed to upload garment image. Try selecting another image.');
      }

      const mannequin = await api.getActiveMannequin();
      const response = await api.createTryOn({
        ...(uploadedGarmentAssetKey ? { garment_asset_key: uploadedGarmentAssetKey } : {}),
        ...(!uploadedGarmentAssetKey && persistedLegacyGarmentImage
          ? { garment_image: persistedLegacyGarmentImage }
          : {}),
        category: 'top',
        selected_size: size,
        mannequin_version_id: mannequin.id,
        chest_cm: parseMeasurementInput(chestInput),
        waist_cm: parseMeasurementInput(waistInput),
        hips_cm: parseMeasurementInput(hipsInput),
      });

      router.push({
        pathname: '/tryon-result',
        params: {
          requestId: response.request.id,
        },
      });
    } catch (error) {
      if (error instanceof api.ApiError && error.status === 404) {
        router.replace('/onboarding');
        return;
      }

      if (error instanceof api.ApiError && error.status === 403) {
        alert(error.message || 'Not enough credits. Buy credits in Billing.');
        return;
      }

      const message = error instanceof Error ? error.message : 'Failed to run try-on';
      alert(message);
    } finally {
      setIsTryingOn(false);
    }
  };

  return (
    <View style={styles.page}>
      <ScreenContainer
        title="Virtual Try-On"
        maxWidth={1024}
        scroll={false}
        contentStyle={styles.screenContent}
      >
        <View style={[styles.layout, isDesktopWeb ? styles.layoutDesktop : styles.layoutMobile]}>
          <View style={[styles.leftColumn, isDesktopWeb ? styles.leftColumnDesktop : styles.leftColumnMobile]}>
            <UploadZone
              onPickImage={() => {
                void handlePickImage();
              }}
              previewUri={garmentImageUri}
              label={isPickingImage ? 'Opening gallery...' : undefined}
              style={[
                styles.uploadZone,
                isDesktopWeb ? styles.uploadZoneDesktop : styles.uploadZoneMobile,
              ]}
            />
          </View>

          <View style={[styles.rightColumn, isDesktopWeb ? styles.rightColumnDesktop : styles.rightColumnMobile]}>
            <View>
              <SectionTitle style={styles.section}>Size</SectionTitle>
              <View style={styles.sizeGroup}>
                {sizes.map((option, index) => {
                  const active = option === size;
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.sizeButton,
                        index > 0 && styles.sizeButtonDivider,
                        active && styles.sizeButtonActive,
                      ]}
                      onPress={() => setSize(option)}
                    >
                      <Text style={[styles.sizeButtonText, active && styles.sizeButtonTextActive]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <SectionTitle style={styles.measurementsTitle}>Measurements</SectionTitle>
              <View style={styles.measurementsGrid}>
                <TextField
                  label="Waist (cm)"
                  value={waistInput}
                  onChangeText={(next) => setWaistInput(sanitizeMeasurementInput(next))}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 74"
                  containerStyle={styles.measurementField}
                />
                <TextField
                  label="Chest (cm)"
                  value={chestInput}
                  onChangeText={(next) => setChestInput(sanitizeMeasurementInput(next))}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 92"
                  containerStyle={styles.measurementField}
                />
                <TextField
                  label="Hips (cm)"
                  value={hipsInput}
                  onChangeText={(next) => setHipsInput(sanitizeMeasurementInput(next))}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 98"
                  containerStyle={styles.measurementField}
                />
              </View>
            </View>
            <Button
              style={styles.cta}
              disabled={!canTryOn}
              onPress={() => {
                void handleTryOn();
              }}
            >
              {isPickingImage ? 'Opening gallery...' : 'Try It On'}
            </Button>
          </View>
        </View>
      </ScreenContainer>

      {isTryingOn ? (
        <View style={styles.fullscreenLoader}>
          <ActivityIndicator size="large" color={uiColors.textOnDark} />
          <Text style={styles.fullscreenLoaderText}>Trying on...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
  },
  layout: {
    flex: 1,
    minHeight: 0,
  },
  layoutDesktop: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'stretch',
  },
  layoutMobile: {
    flexDirection: 'column',
    gap: 20,
  },
  leftColumn: {
    minHeight: 0,
  },
  leftColumnDesktop: {
    flex: 1,
  },
  leftColumnMobile: {
    width: '100%',
  },
  uploadZone: {
    width: '100%',
    alignSelf: 'stretch',
  },
  uploadZoneDesktop: {
    flex: 1,
    minHeight: 0,
  },
  uploadZoneMobile: {
    minHeight: 280,
  },
  rightColumn: {
    minHeight: 0,
  },
  rightColumnDesktop: {
    width: 420,
    maxWidth: '42%',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  rightColumnMobile: {
    width: '100%',
    gap: 16,
  },
  section: {
    marginBottom: 10,
  },
  sizeGroup: {
    flexDirection: 'row',
    width: '100%',
    borderWidth: 1,
    borderColor: uiColors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: uiColors.surface,
    marginBottom: 20,
  },
  sizeButton: {
    flex: 1,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: uiColors.surface,
  },
  sizeButtonDivider: {
    borderLeftWidth: 1,
    borderLeftColor: uiColors.borderSoft,
  },
  sizeButtonActive: {
    backgroundColor: uiColors.textPrimary,
  },
  sizeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: uiColors.textSecondary,
  },
  sizeButtonTextActive: {
    color: uiColors.surface,
  },
  measurementsTitle: {
    marginBottom: 12,
  },
  measurementsGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  measurementField: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 110,
    marginBottom: 0,
  },
  cta: {
    width: '100%',
  },
  fullscreenLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: uiColors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 20,
  },
  fullscreenLoaderText: {
    color: uiColors.textOnDark,
    fontSize: 28,
    fontWeight: '700',
  },
});
