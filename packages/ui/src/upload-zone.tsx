import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { uiColors } from './colors';

interface UploadZoneProps {
  onPickImage?: () => void;
  previewUri?: string | null;
  label?: string;
  details?: string;
  style?: StyleProp<ViewStyle>;
}

export function UploadZone({
  onPickImage,
  previewUri,
  label,
  details = 'Up to 25 MB\nJPG, PNG, HEIC',
  style,
}: UploadZoneProps) {
  return (
    <Pressable onPress={onPickImage} style={[styles.zone, style]}>
      {previewUri ? (
        <>
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
        </>
      ) : (
        <>
          <Ionicons name="add-circle-outline" size={56} color={uiColors.borderStrong} style={styles.icon} />
          {label ? <Text style={styles.label}>{label}</Text> : null}
          <Text style={styles.details}>{details}</Text>
        </>
      )}
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
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: uiColors.surfaceSoft,
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  previewHint: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: uiColors.textOnDark,
    backgroundColor: 'rgba(17, 17, 17, 0.55)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingVertical: 7,
    paddingHorizontal: 12,
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
