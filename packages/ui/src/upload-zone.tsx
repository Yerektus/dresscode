import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { uiColors } from './colors';

interface UploadZoneProps {
  onPickImage?: () => void;
  label?: string;
  details?: string;
  style?: StyleProp<ViewStyle>;
}

export function UploadZone({
  onPickImage,
  label,
  details = 'Up to 25 MB\nJPG, PNG, HEIC',
  style,
}: UploadZoneProps) {
  return (
    <Pressable onPress={onPickImage} style={[styles.zone, style]}>
      <Ionicons name="add-circle-outline" size={56} color={uiColors.borderStrong} style={styles.icon} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Text style={styles.details}>{details}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: {
    width: 160,
    minHeight: 180,
    borderWidth: 1,
    borderColor: uiColors.borderSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: uiColors.surfaceSoft,
  },
  icon: {
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    color: uiColors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  details: {
    fontSize: 11,
    lineHeight: 15,
    color: uiColors.textHint,
    textAlign: 'center',
    fontWeight: '500',
  },
});
