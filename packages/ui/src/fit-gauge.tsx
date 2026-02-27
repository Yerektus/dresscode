import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { uiColors } from './colors';

export interface FitGaugeProps {
  /** Recommended size label (e.g., "Medium", "Large") */
  recommendedSize: string;
  /** Fit probability value from 0 to 100. 50 = True Fit center */
  fitProbability: number;
  /** Optional callback when user taps "Switch/Add profile" */
  onSwitchProfile?: () => void;
}

/**
 * Converts fit probability (0-100) to gauge angle.
 * 0 = Tight (left, -90°), 50 = True Fit (center, 0°), 100 = Loose (right, 90°)
 */
function probabilityToAngle(probability: number): number {
  const clampedValue = Math.max(0, Math.min(100, probability));
  // Map 0-100 to -90 to 90 degrees
  return (clampedValue - 50) * 1.8;
}

/**
 * Returns fit label based on probability value
 */
function getFitLabel(probability: number): 'Tight' | 'True Fit' | 'Loose' {
  if (probability < 35) return 'Tight';
  if (probability > 65) return 'Loose';
  return 'True Fit';
}

const GAUGE_SIZE = 180;
const GAUGE_RADIUS = GAUGE_SIZE / 2;
const NEEDLE_WIDTH = 36; // degrees of the wedge

export function FitGauge({
  recommendedSize,
  fitProbability,
  onSwitchProfile,
}: FitGaugeProps) {
  const angle = probabilityToAngle(fitProbability);
  const fitLabel = getFitLabel(fitProbability);

  // The needle rotation: -90 is left (Tight), 0 is center (True Fit), 90 is right (Loose)
  const needleRotation = angle;

  return (
    <View style={styles.container}>
      <Text style={styles.headerLabel}>Your Recommended</Text>
      <Text style={styles.sizeLabel}>{recommendedSize}</Text>

      <View style={styles.gaugeContainer}>
        {/* Semicircle background */}
        <View style={styles.gaugeBackground}>
          <View style={styles.gaugeInner} />
        </View>

        {/* Needle wedge - positioned at center bottom, rotated */}
        <View style={styles.needleContainer}>
          <View
            style={[
              styles.needle,
              { transform: [{ rotate: `${needleRotation}deg` }] },
            ]}
          >
            <View style={styles.needleWedge} />
          </View>
        </View>

        {/* Center point */}
        <View style={styles.centerDot} />

        {/* Fit label */}
        <View style={styles.fitLabelContainer}>
          <Text style={styles.fitLabel}>{fitLabel}</Text>
        </View>
      </View>

      {/* Tight / Loose labels */}
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>Tight</Text>
        <Text style={styles.scaleLabel}>Loose</Text>
      </View>

      <Text style={styles.descriptionText}>
        This size will fit you best based on{' '}
        <Text style={styles.highlightText}>your profile</Text>
      </Text>

      {onSwitchProfile ? (
        <Text style={styles.switchText} onPress={onSwitchProfile}>
          Not for you? <Text style={styles.linkText}>Switch/Add profile</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: uiColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
  },
  headerLabel: {
    fontSize: 14,
    color: uiColors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  sizeLabel: {
    fontSize: 42,
    fontWeight: '600',
    color: uiColors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  gaugeContainer: {
    width: GAUGE_SIZE,
    height: GAUGE_RADIUS + 10,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 8,
  },
  gaugeBackground: {
    position: 'absolute',
    bottom: 0,
    width: GAUGE_SIZE,
    height: GAUGE_RADIUS,
    borderTopLeftRadius: GAUGE_RADIUS,
    borderTopRightRadius: GAUGE_RADIUS,
    backgroundColor: uiColors.surfaceMuted,
    overflow: 'hidden',
  },
  gaugeInner: {
    position: 'absolute',
    bottom: -GAUGE_RADIUS * 0.4,
    left: GAUGE_RADIUS * 0.4,
    width: GAUGE_SIZE * 0.6,
    height: GAUGE_SIZE * 0.6,
    borderRadius: GAUGE_SIZE * 0.3,
    backgroundColor: uiColors.surface,
  },
  needleContainer: {
    position: 'absolute',
    bottom: 0,
    width: GAUGE_SIZE,
    height: GAUGE_RADIUS,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  needle: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    height: 0,
    alignItems: 'center',
    transformOrigin: 'center bottom',
  },
  needleWedge: {
    width: 0,
    height: 0,
    borderLeftWidth: NEEDLE_WIDTH / 2,
    borderRightWidth: NEEDLE_WIDTH / 2,
    borderBottomWidth: GAUGE_RADIUS - 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: uiColors.textPrimary,
    position: 'absolute',
    bottom: 0,
  },
  centerDot: {
    position: 'absolute',
    bottom: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: uiColors.textPrimary,
    zIndex: 10,
  },
  fitLabelContainer: {
    position: 'absolute',
    top: 35,
    alignItems: 'center',
  },
  fitLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: uiColors.textPrimary,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: GAUGE_SIZE,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  scaleLabel: {
    fontSize: 13,
    color: uiColors.textMuted,
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 14,
    color: uiColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  highlightText: {
    fontWeight: '600',
    color: uiColors.textPrimary,
  },
  switchText: {
    fontSize: 13,
    color: uiColors.textMuted,
    marginTop: 8,
  },
  linkText: {
    color: uiColors.textPrimary,
    textDecorationLine: 'underline',
  },
});
