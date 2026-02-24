import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@repo/ui/button';
import { ScreenContainer } from '@repo/ui/screen-container';
import { SectionTitle } from '@repo/ui/section-title';
import { uiColors } from '@repo/ui/colors';
import * as api from '@/services/api';
import { useAuth } from '@/providers/auth-provider';

function asStringParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    const firstValue = value[0];
    return typeof firstValue === 'string' && firstValue.trim() ? firstValue : null;
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return null;
}

export default function OnboardingResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUrl?: string | string[] }>();
  const { isAuthenticated, isLoading } = useAuth();
  const initialImageUrl = useMemo(() => asStringParam(params.imageUrl), [params.imageUrl]);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [isLoadingImage, setIsLoadingImage] = useState(!initialImageUrl);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    setImageUrl(initialImageUrl);
    setIsLoadingImage(!initialImageUrl);
  }, [initialImageUrl]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || imageUrl) {
      return;
    }

    let active = true;
    const loadLatestMannequin = async () => {
      try {
        const mannequin = await api.getActiveMannequin();
        if (active) {
          setImageUrl(mannequin.front_image_url);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof api.ApiError && error.status === 404) {
          router.replace('/onboarding');
          return;
        }

        alert(error instanceof Error ? error.message : 'Failed to load mannequin');
      } finally {
        if (active) {
          setIsLoadingImage(false);
        }
      }
    };

    void loadLatestMannequin();

    return () => {
      active = false;
    };
  }, [imageUrl, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const handleRegenerate = async () => {
    if (isRegenerating) {
      return;
    }

    try {
      setIsRegenerating(true);
      const mannequin = await api.generateMannequin();
      setImageUrl(mannequin.front_image_url);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to regenerate mannequin');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <ScreenContainer
      title="Generated mannequin"
      subtitle="Review the generated image. Save it to continue or regenerate for another version."
      maxWidth={640}
      centerContent
    >
      {isLoadingImage ? (
        <View style={styles.loader}>
          <ActivityIndicator color={uiColors.textOnLight} />
        </View>
      ) : null}

      {imageUrl ? (
        <View style={styles.previewSection}>
          <SectionTitle style={styles.sectionTitle} variant="muted">Result</SectionTitle>
          <View style={styles.previewFrame}>
            <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />
          </View>
        </View>
      ) : (
        <Button variant="secondary" style={styles.backButton} onPress={() => router.replace('/onboarding')}>
          Back to parameters
        </Button>
      )}

      <View style={styles.actions}>
        <Button
          variant="secondary"
          style={styles.actionButton}
          onPress={handleRegenerate}
          loading={isRegenerating}
          disabled={isLoadingImage}
        >
          Regenerate
        </Button>
        <Button
          style={styles.actionButton}
          onPress={() => router.replace('/(tabs)')}
          disabled={!imageUrl || isRegenerating}
        >
          Save and continue
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 8,
    marginBottom: 16,
  },
  previewSection: {
    width: '100%',
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
  backButton: {
    marginTop: 12,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
  },
  sectionTitle: {
    textAlign: 'center',
  }
});
