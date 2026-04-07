import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLOUR_CODES, COLOUR_CODE_STYLES, ColourCode } from '@firstresponders/shared';

interface Props {
  value: ColourCode | null;
  onChange: (code: ColourCode) => void;
}

export function ColourCodePicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {COLOUR_CODES.map((code) => {
        const style = COLOUR_CODE_STYLES[code];
        const selected = value === code;
        return (
          <TouchableOpacity
            key={code}
            style={[
              styles.btn,
              { backgroundColor: style.bg },
              selected && styles.selected,
            ]}
            onPress={() => onChange(code)}
            activeOpacity={0.7}
            accessibilityLabel={`${style.label}: ${style.description}`}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {style.label}
            </Text>
            <Text style={[styles.desc, selected && styles.descSelected]}>
              {style.description}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  btn: {
    flex: 1,
    minWidth: 60,
    minHeight: 64,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    opacity: 0.6,
  },
  selected: {
    opacity: 1,
    borderWidth: 3,
    borderColor: '#000',
  },
  label: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  labelSelected: {
    fontSize: 14,
  },
  desc: {
    color: '#fff',
    fontSize: 9,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  descSelected: {
    fontSize: 10,
  },
});
