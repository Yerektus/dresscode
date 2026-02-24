import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';

interface ImagePreviewProps {
  source: ImageSourcePropType | { uri: string };
  width?: number;
  height?: number;
}

export function ImagePreview({ source, width = 300, height = 400 }: ImagePreviewProps) {
  return (
    <View style={[styles.container, { width, height }]}>
      <Image source={source} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
