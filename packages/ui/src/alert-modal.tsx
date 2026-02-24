import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './button';
import { uiColors } from './colors';
import { DisplayTitle } from './display-title';

export interface AlertModalAction {
  label: string;
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
  dismissOnPress?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

interface AlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  actions: AlertModalAction[];
  onClose: () => void;
}

export function AlertModal({
  visible,
  title,
  message,
  actions,
  onClose,
}: AlertModalProps) {
  const safeActions = actions.length > 0 ? actions : [{ label: 'OK' }];

  const handleActionPress = (action: AlertModalAction) => {
    action.onPress?.();
    if (action.dismissOnPress !== false) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <DisplayTitle style={styles.title}>{title}</DisplayTitle>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View
            style={[
              styles.actions,
              safeActions.length === 1 ? styles.actionsSingle : styles.actionsMultiple,
            ]}
          >
            {safeActions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant ?? 'primary'}
                style={styles.actionButton}
                onPress={() => handleActionPress(action)}
                disabled={action.disabled}
                loading={action.loading}
              >
                {action.label}
              </Button>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: uiColors.overlay,
  },
  card: {
    width: '90%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: uiColors.surface,
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    padding: 18,
    zIndex: 1,
  },
  title: {
    fontSize: 32,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: uiColors.textTertiary,
  },
  actions: {
    marginTop: 18,
    gap: 10,
  },
  actionsSingle: {
    flexDirection: 'column',
  },
  actionsMultiple: {
    flexDirection: 'row',
  },
  actionButton: {
    flex: 1,
  },
});
