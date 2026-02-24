import { View, Text, TextInput, StyleSheet } from 'react-native';

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
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            style={styles.input}
            value={field.value}
            onChangeText={(v) => onChangeField(field.key, v)}
            placeholder={field.placeholder}
            keyboardType={field.keyboardType ?? 'default'}
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
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
});
