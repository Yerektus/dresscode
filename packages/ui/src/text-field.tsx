import {
  KeyboardTypeOptions,
  Pressable,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useState } from 'react';
import { uiColors } from './colors';

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'keyboardType'> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

const webInputTransition = Platform.select({
  web: {
    transitionProperty: 'border-color',
    transitionDuration: '80ms',
    transitionTimingFunction: 'ease-in-out',
  } as unknown as TextStyle,
});

export function TextField({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  containerStyle,
  inputStyle,
  placeholderTextColor,
  ...props
}: TextFieldProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onHoverIn={() => setIsHovered(true)} onHoverOut={() => setIsHovered(false)}>
        <TextInput
          style={[styles.input, webInputTransition, isHovered && styles.inputHover, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholderTextColor={placeholderTextColor ?? uiColors.textHint}
          {...props}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: uiColors.textDark,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: uiColors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: uiColors.textPrimary,
    backgroundColor: uiColors.surfaceSoft,
  },
  inputHover: {
    borderColor: uiColors.borderStrong,
  },
});
