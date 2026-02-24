import { View, StyleSheet } from 'react-native';
import { ReactNode } from 'react';

interface ResultLayoutProps {
  image: ReactNode;
  badge: ReactNode;
  actions?: ReactNode;
}

export function ResultLayout({ image, badge, actions }: ResultLayoutProps) {
  return (
    <View style={styles.container}>
      <View style={styles.imageSection}>{image}</View>
      <View style={styles.badgeSection}>{badge}</View>
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 24,
  },
  imageSection: {
    marginBottom: 24,
  },
  badgeSection: {
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
});
