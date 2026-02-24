import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useState } from 'react';
import { Button } from '@repo/ui/button';
import { ChoiceChips } from '@repo/ui/choice-chips';
import { ScreenContainer } from '@repo/ui/screen-container';
import { SectionTitle } from '@repo/ui/section-title';
import { UploadZone } from '@repo/ui/upload-zone';

export default function TryOnScreen() {
  const { width } = useWindowDimensions();
  const [size, setSize] = useState<string>('M');
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;

  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  return (
    <ScreenContainer
      title="Virtual Try-On"
      maxWidth={1120}
      scroll={false}
      contentStyle={styles.screenContent}
    >
      <View style={[styles.layout, isDesktopWeb ? styles.layoutDesktop : styles.layoutMobile]}>
        <View style={[styles.leftColumn, isDesktopWeb ? styles.leftColumnDesktop : styles.leftColumnMobile]}>
          <UploadZone
            style={[
              styles.uploadZone,
              isDesktopWeb ? styles.uploadZoneDesktop : styles.uploadZoneMobile,
            ]}
          />
        </View>

        <View style={[styles.rightColumn, isDesktopWeb ? styles.rightColumnDesktop : styles.rightColumnMobile]}>
          <View>
            <SectionTitle style={styles.section}>Size</SectionTitle>
            <ChoiceChips options={sizes} value={size} onChange={setSize} />
          </View>
          <Button style={styles.cta}>Try It On</Button>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
  },
  layout: {
    flex: 1,
    minHeight: 0,
  },
  layoutDesktop: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'stretch',
  },
  layoutMobile: {
    flexDirection: 'column',
    gap: 20,
  },
  leftColumn: {
    minHeight: 0,
  },
  leftColumnDesktop: {
    flex: 1,
  },
  leftColumnMobile: {
    width: '100%',
  },
  uploadZone: {
    width: '100%',
    alignSelf: 'stretch',
  },
  uploadZoneDesktop: {
    flex: 1,
    minHeight: 0,
  },
  uploadZoneMobile: {
    minHeight: 280,
  },
  rightColumn: {
    minHeight: 0,
  },
  rightColumnDesktop: {
    width: 420,
    maxWidth: '42%',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  rightColumnMobile: {
    width: '100%',
    gap: 16,
  },
  section: {
    marginBottom: 0,
  },
  cta: {
    width: '100%',
  },
});
