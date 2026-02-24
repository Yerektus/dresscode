import { Pressable, Text, StyleProp, StyleSheet, Platform, ViewStyle } from 'react-native';

interface UploadZoneProps {
  onPickImage?: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function UploadZone({ onPickImage, label = 'Upload clothing image', style }: UploadZoneProps) {
  return (
    <Pressable onPress={onPickImage} style={[styles.zone, style]}>
      <Text style={styles.icon}>+</Text>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'web' && (
        <Text style={styles.hint}>or drag & drop here</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  icon: {
    fontSize: 32,
    color: '#999',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
  hint: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 4,
  },
});
