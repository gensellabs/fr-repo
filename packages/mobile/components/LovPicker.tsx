import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';

export interface LovOption {
  id: number;
  value: string;
  [key: string]: unknown;
}

interface Props {
  label: string;
  value: LovOption | null;
  options: LovOption[];
  onSelect: (option: LovOption) => void;
  onAddNew?: (value: string) => Promise<LovOption>;
  placeholder?: string;
  required?: boolean;
  displayKey?: keyof LovOption;
}

export function LovPicker({
  label,
  value,
  options,
  onSelect,
  onAddNew,
  placeholder = 'Select or search...',
  required,
  displayKey = 'value',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => String(o[displayKey]).toLowerCase().includes(q));
  }, [options, search, displayKey]);

  const hasExactMatch = useMemo(
    () => options.some((o) => String(o[displayKey]).toLowerCase() === search.toLowerCase().trim()),
    [options, search, displayKey],
  );

  const canAddNew = onAddNew && search.trim().length > 1 && !hasExactMatch;

  async function handleAddNew() {
    if (!onAddNew || !search.trim()) return;
    setAdding(true);
    try {
      const newOption = await onAddNew(search.trim());
      onSelect(newOption);
      setOpen(false);
      setSearch('');
    } catch (e) {
      alert('Could not add new value. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        <TouchableOpacity
          style={[styles.selector, !value && styles.selectorEmpty]}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? String(value[displayKey]) : placeholder}`}
        >
          <Text style={[styles.selectorText, !value && styles.placeholderText]} numberOfLines={1}>
            {value ? String(value[displayKey]) : placeholder}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <TouchableOpacity onPress={() => { setOpen(false); setSearch(''); }} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search or type new value..."
            placeholderTextColor="#9ca3af"
            autoFocus
            clearButtonMode="while-editing"
          />

          {canAddNew && (
            <TouchableOpacity style={styles.addRow} onPress={handleAddNew} disabled={adding}>
              {adding
                ? <ActivityIndicator size="small" color="#dc2626" />
                : <Text style={styles.addTxt}>＋ Add "{search.trim()}"</Text>
              }
            </TouchableOpacity>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.option, value?.id === item.id && styles.optionSelected]}
                onPress={() => { onSelect(item); setOpen(false); setSearch(''); }}
                activeOpacity={0.6}
              >
                <Text style={[styles.optionText, value?.id === item.id && styles.optionTextSelected]}>
                  {String(item[displayKey])}
                </Text>
                {value?.id === item.id && <Text style={styles.tick}>✓</Text>}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {search.trim() ? 'No match — use "Add" above to create it.' : 'No options available.'}
              </Text>
            }
          />
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  required: { color: '#dc2626' },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#fff',
    minHeight: 50,
  },
  selectorEmpty: { borderColor: '#e5e7eb' },
  selectorText: { fontSize: 16, color: '#111827', flex: 1 },
  placeholderText: { color: '#9ca3af' },
  chevron: { fontSize: 16, color: '#6b7280', marginLeft: 8 },
  modal: { flex: 1, backgroundColor: '#f9fafb' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 8 },
  closeTxt: { fontSize: 18, color: '#6b7280' },
  search: {
    margin: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#111827',
  },
  addRow: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    padding: 14,
    alignItems: 'center',
  },
  addTxt: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    backgroundColor: '#fff',
    minHeight: 52,
  },
  optionSelected: { backgroundColor: '#fef2f2' },
  optionText: { fontSize: 16, color: '#111827' },
  optionTextSelected: { color: '#dc2626', fontWeight: '600' },
  tick: { color: '#dc2626', fontSize: 18 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 32, fontSize: 15 },
});
