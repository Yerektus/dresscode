import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@repo/ui/button';
import { PlanCard } from '@repo/ui/plan-card';
import { ProfileForm } from '@repo/ui/profile-form';
import { ScreenContainer } from '@repo/ui/screen-container';
import { SectionTitle } from '@repo/ui/section-title';
import { TextLink } from '@repo/ui/text-link';
import { useAuth } from '@/providers/auth-provider';

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('70');

  const handleSignOut = () => {
    signOut();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer title="Profile">
      <View style={styles.section}>
        <SectionTitle>Body Parameters</SectionTitle>
        <ProfileForm
          fields={[
            {
              key: 'height',
              label: 'Height (cm)',
              value: height,
              keyboardType: 'numeric',
            },
            {
              key: 'weight',
              label: 'Weight (kg)',
              value: weight,
              keyboardType: 'numeric',
            },
          ]}
          onChangeField={(key, value) => {
            if (key === 'height') {
              setHeight(value);
              return;
            }
            if (key === 'weight') {
              setWeight(value);
            }
          }}
        />
        <Button style={styles.saveBtn}>Update & Regenerate Mannequin</Button>
      </View>

      <View style={styles.section}>
        <SectionTitle>Subscription</SectionTitle>
        <PlanCard name="Free Plan" detail="5 try-ons / month · 30-day history" />
        <Button variant="secondary">Upgrade to Premium</Button>
      </View>

      <TextLink
        tone="danger"
        align="center"
        pressableStyle={styles.logoutBtn}
        onPress={handleSignOut}
      >
        Sign Out
      </TextLink>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  saveBtn: {
    marginTop: 8,
  },
  logoutBtn: {
    marginTop: 16,
  },
});
