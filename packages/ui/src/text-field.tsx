import {
  KeyboardTypeOptions,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { uiColors } from './colors';

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'keyboardType'> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

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
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={placeholderTextColor ?? uiColors.textHint}
        {...props}
      />
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
});
