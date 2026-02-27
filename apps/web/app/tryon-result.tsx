import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@repo/ui/button';
import { FitGauge } from '@repo/ui/fit-gauge';
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatCategory(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatMeasurement(value: number | null): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return `${Math.round(Number(value))} cm`;
}

export default function TryOnResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const { isAuthenticated, isLoading } = useAuth();
  const requestId = useMemo(() => asStringParam(params.requestId), [params.requestId]);
  const [item, setItem] = useState<api.TryOnHistoryItemResponse | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }

    if (!requestId) {
      setErrorMessage('Result ID is missing');
      setIsFetching(false);
      return;
    }

    let active = true;
    const loadResult = async () => {
      try {
        setIsFetching(true);
        setErrorMessage(null);

        const nextItem = await api.getTryOnById(requestId);
        if (!active) {
          return;
        }

        setItem(nextItem);
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Failed to load try-on result';
        setErrorMessage(message);
      } finally {
        if (active) {
          setIsFetching(false);
        }
      }
    };

    void loadResult();

    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoading, requestId]);

  useEffect(() => {
    setImageFailed(false);
  }, [item?.result?.result_image_url]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const fitProbability = item?.result
    ? Math.round(Number(item.result.fit_probability))
    : null;

  return (
    <ScreenContainer
      title="Try-On Result"
      subtitle="Review your generated virtual try-on result."
      maxWidth={760}
    >
      {isFetching ? (
        <View style={styles.loader}>
          <ActivityIndicator color={uiColors.textOnLight} />
        </View>
      ) : null}

      {!isFetching && errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {!isFetching && item ? (
        <>
          <View style={styles.previewSection}>
            <SectionTitle style={styles.sectionTitle} variant="muted">Result</SectionTitle>
            <View style={styles.previewFrame}>
              {item.result?.result_image_url && !imageFailed ? (
                <Image
                  source={{ uri: item.result.result_image_url }}
                  style={styles.previewImage}
                  resizeMode="contain"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <View style={styles.previewFallback}>
                  <Text style={styles.previewFallbackText}>Result preview unavailable</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Category</Text>
            <Text style={styles.metaValue}>{formatCategory(item.category)}</Text>

            <Text style={styles.metaLabel}>Selected size</Text>
            <Text style={styles.metaValue}>{item.selected_size}</Text>

            <Text style={styles.metaLabel}>Chest</Text>
            <Text style={styles.metaValue}>{formatMeasurement(item.chest_cm)}</Text>

            <Text style={styles.metaLabel}>Waist</Text>
            <Text style={styles.metaValue}>{formatMeasurement(item.waist_cm)}</Text>

            <Text style={styles.metaLabel}>Hips</Text>
            <Text style={styles.metaValue}>{formatMeasurement(item.hips_cm)}</Text>

            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{formatDate(item.created_at)}</Text>
          </View>

          {fitProbability !== null ? (
            <View style={styles.fitGaugeContainer}>
              <FitGauge
                recommendedSize={item.selected_size}
                fitProbability={fitProbability}
              />
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.actions}>
        <Button
          variant="secondary"
          style={styles.actionButton}
          onPress={() => router.replace('/(tabs)/history')}
        >
          Open History
        </Button>
        <Button
          style={styles.actionButton}
          onPress={() => router.replace('/(tabs)')}
        >
          Back to Try On
        </Button>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 8,
    marginBottom: 14,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: uiColors.danger,
    lineHeight: 20,
  },
  previewSection: {
    width: '100%',
  },
  sectionTitle: {
    textAlign: 'center',
  },
  previewFrame: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    aspectRatio: 2 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: uiColors.surfaceMuted,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  previewFallbackText: {
    fontSize: 15,
    color: uiColors.textMuted,
    textAlign: 'center',
  },
  metaCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    borderRadius: 14,
    backgroundColor: uiColors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: uiColors.textMuted,
    fontWeight: '600',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaValue: {
    fontSize: 16,
    color: uiColors.textPrimary,
    fontWeight: '500',
    marginBottom: 4,
  },
  fitGaugeContainer: {
    marginTop: 16,
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
  },
});
