import React, { useRef } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';

interface Props {
  systolic: string;
  diastolic: string;
  onChangeSystolic: (v: string) => void;
  onChangeDiastolic: (v: string) => void;
}

export function BpInput({ systolic, diastolic, onChangeSystolic, onChangeDiastolic }: Props) {
  const diastolicRef = useRef<TextInput>(null);

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={systolic}
        onChangeText={(v) => {
          onChangeSystolic(v.replace(/\D/g, '').slice(0, 3));
          if (v.length >= 3) diastolicRef.current?.focus();
        }}
        keyboardType="number-pad"
        placeholder="SYS"
        placeholderTextColor="#9ca3af"
        maxLength={3}
        returnKeyType="next"
        onSubmitEditing={() => diastolicRef.current?.focus()}
        accessibilityLabel="Systolic blood pressure"
      />
      <Text style={styles.slash}>/</Text>
      <TextInput
        ref={diastolicRef}
        style={styles.input}
        value={diastolic}
        onChangeText={(v) => onChangeDiastolic(v.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
        placeholder="DIA"
        placeholderTextColor="#9ca3af"
        maxLength={3}
        returnKeyType="done"
        accessibilityLabel="Diastolic blood pressure"
      />
      <Text style={styles.unit}>mmHg</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    width: 72,
    textAlign: 'center',
    backgroundColor: '#fff',
    color: '#111827',
  },
  slash: {
    fontSize: 24,
    fontWeight: '300',
    color: '#6b7280',
  },
  unit: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 4,
  },
});
