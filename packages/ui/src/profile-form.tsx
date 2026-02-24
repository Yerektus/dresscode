import { View, StyleSheet } from 'react-native';
import { uiColors } from './colors';
import { TextField } from './text-field';

interface ProfileField {
  key: string;
  label: string;
  value: string;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}

interface ProfileFormProps {
  fields: ProfileField[];
  onChangeField: (key: string, value: string) => void;
}

export function ProfileForm({ fields, onChangeField }: ProfileFormProps) {
  return (
    <View style={styles.form}>
      {fields.map((field) => (
        <View key={field.key} style={styles.fieldGroup}>
          <TextField
            label={field.label}
            value={field.value}
            placeholder={field.placeholder}
            keyboardType={field.keyboardType ?? 'default'}
            onChangeText={(value) => onChangeField(field.key, value)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: uiColors.textDark,
  },
  input: {
    borderWidth: 1,
    borderColor: uiColors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: uiColors.surface,
  },
  inputHover: {
    borderColor: uiColors.borderStrong,
  },
});
