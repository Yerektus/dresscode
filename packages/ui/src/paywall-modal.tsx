import { View, Text, Modal, StyleSheet, Pressable } from 'react-native';
import { uiColors } from './colors';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
}

export function PaywallModal({ visible, onClose, onSubscribe }: PaywallModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Upgrade to Premium</Text>
          <Text style={styles.description}>
            Get unlimited try-ons, full history, and enhanced AI model access.
          </Text>
          <View style={styles.features}>
            <Text style={styles.feature}>✓ 200+ try-ons per month</Text>
            <Text style={styles.feature}>✓ Unlimited history</Text>
            <Text style={styles.feature}>✓ Enhanced model (coming soon)</Text>
          </View>
          <Pressable onPress={onSubscribe} style={styles.cta}>
            <Text style={styles.ctaText}>Subscribe Now</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.dismiss}>
            <Text style={styles.dismissText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: uiColors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: uiColors.surface,
    borderRadius: 24,
    padding: 32,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: uiColors.textPrimary,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: uiColors.textTertiary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  features: {
    alignSelf: 'stretch',
    marginBottom: 24,
    gap: 8,
  },
  feature: {
    fontSize: 15,
    color: uiColors.textDark,
  },
  cta: {
    backgroundColor: uiColors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 50,
    marginBottom: 12,
  },
  ctaText: {
    color: uiColors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  dismiss: {
    padding: 8,
  },
  dismissText: {
    color: uiColors.textSubtle,
    fontSize: 14,
  },
});
