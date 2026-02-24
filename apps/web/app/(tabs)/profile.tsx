import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useState } from 'react';

export default function ProfileScreen() {
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('70');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Body Parameters</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Height (cm)</Text>
          <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" />
        </View>
        <Pressable style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Update & Regenerate Mannequin</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.planCard}>
          <Text style={styles.planName}>Free Plan</Text>
          <Text style={styles.planDetail}>5 try-ons / month · 30-day history</Text>
        </View>
        <Pressable style={styles.upgradeBtn}>
          <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Sign Out</Text>
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  saveBtn: {
    backgroundColor: '#111',
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  planCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  planDetail: {
    fontSize: 14,
    color: '#888',
  },
  upgradeBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#111',
  },
  upgradeBtnText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '500',
  },
});
