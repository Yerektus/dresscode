import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useState } from 'react';

export default function TryOnScreen() {
  const [category, setCategory] = useState<string>('top');
  const [size, setSize] = useState<string>('M');

  const categories = ['top', 'bottom', 'dress', 'outerwear'];
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Virtual Try-On</Text>

      <View style={styles.uploadZone}>
        <Text style={styles.uploadIcon}>+</Text>
        <Text style={styles.uploadLabel}>Upload clothing image</Text>
        {Platform.OS === 'web' && (
          <Text style={styles.uploadHint}>or drag & drop here</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.chips}>
        {categories.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, category === c && styles.chipActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Size</Text>
      <View style={styles.chips}>
        {sizes.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, size === s && styles.chipActive]}
            onPress={() => setSize(s)}
          >
            <Text style={[styles.chipText, size === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.cta}>
        <Text style={styles.ctaText}>Try It On</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  content: {
    padding: 24,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 24,
    marginTop: Platform.OS === 'web' ? 40 : 60,
    ...(Platform.OS === 'web' ? { fontFamily: "Georgia, 'Times New Roman', serif" } : {}),
  },
  uploadZone: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginBottom: 32,
  },
  uploadIcon: {
    fontSize: 32,
    color: '#999',
    marginBottom: 8,
  },
  uploadLabel: {
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
  },
  uploadHint: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  chipText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },
  cta: {
    backgroundColor: '#111',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
