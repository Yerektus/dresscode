import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '@repo/ui/button';
import { HistoryCard } from '@repo/ui/card';
import { uiColors } from '@repo/ui/colors';
import { ScreenContainer } from '@repo/ui/screen-container';
import * as api from '@/services/api';

function formatCategory(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatMeasurementShort(label: string, value: number | null | undefined): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  return `${label}${Math.round(Number(value))}`;
}

function formatMeasurementSummary(item: api.TryOnHistoryItemResponse): string | undefined {
  const parts = [
    formatMeasurementShort('W', item.waist_cm),
    formatMeasurementShort('C', item.chest_cm),
    formatMeasurementShort('H', item.hips_cm),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? `${parts.join(' / ')} cm` : undefined;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<api.TryOnHistoryItemResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const history = await api.getTryOnHistory();
      setItems(history.filter((item) => Boolean(item.result)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  return (
    <ScreenContainer title="History">
      {isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={uiColors.textOnLight} />
        </View>
      ) : null}

      {!isLoading && errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Button variant="secondary" style={styles.retryButton} onPress={() => {
            void loadHistory();
          }}>
            Retry
          </Button>
        </View>
      ) : null}

      {!isLoading && !errorMessage && items.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.emptyText}>No try-on results yet</Text>
          <Text style={styles.emptyHint}>Generate your first virtual try-on from the Try On tab.</Text>
        </View>
      ) : null}

      {!isLoading && !errorMessage && items.map((item) => (
        <HistoryCard
          key={item.id}
          title={`${formatCategory(item.category)} Try-On`}
          category={formatCategory(item.category)}
          size={item.selected_size}
          measurements={formatMeasurementSummary(item)}
          fitProbability={Math.round(Number(item.result?.fit_probability ?? 0))}
          date={formatDate(item.created_at)}
          onPress={() => {
            router.push({
              pathname: '/tryon-result',
              params: { requestId: item.id },
            });
          }}
        />
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stateCard: {
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    borderRadius: 12,
    backgroundColor: uiColors.surface,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: uiColors.danger,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: uiColors.textPrimary,
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 14,
    color: uiColors.textMuted,
    lineHeight: 20,
  },
});
