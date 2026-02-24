import { StyleSheet } from 'react-native';
import { useState } from 'react';
import { Button } from '@repo/ui/button';
import { ChoiceChips } from '@repo/ui/choice-chips';
import { ScreenContainer } from '@repo/ui/screen-container';
import { SectionTitle } from '@repo/ui/section-title';
import { UploadZone } from '@repo/ui/upload-zone';

export default function TryOnScreen() {
  const [category, setCategory] = useState<string>('top');
  const [size, setSize] = useState<string>('M');

  const categories = ['top', 'bottom', 'dress', 'outerwear'];
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  return (
    <ScreenContainer title="Virtual Try-On">
      <UploadZone style={styles.uploadZone} />

      <SectionTitle style={styles.section}>Category</SectionTitle>
      <ChoiceChips
        options={categories}
        value={category}
        onChange={setCategory}
        formatLabel={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
      />

      <SectionTitle style={styles.section}>Size</SectionTitle>
      <ChoiceChips options={sizes} value={size} onChange={setSize} />

      <Button style={styles.cta}>Try It On</Button>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  uploadZone: {
    marginBottom: 32,
  },
  section: {
    marginBottom: 0,
  },
  cta: {
    marginTop: 8,
  },
});
