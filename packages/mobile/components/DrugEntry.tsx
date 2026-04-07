import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { DrugEntry as DrugEntryType } from '../store/incidentDraft';

interface DrugOption {
  id: number;
  name: string;
  defaultUom: string | null;
}

interface Props {
  drugs: DrugEntryType[];
  drugOptions: DrugOption[];
  onChange: (drugs: DrugEntryType[]) => void;
}

export function DrugEntryList({ drugs, drugOptions, onChange }: Props) {
  const [pickingDrug, setPickingDrug] = useState<number | null>(null); // index being edited or -1 for new
  const [search, setSearch] = useState('');

  const filteredDrugs = drugOptions.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  function addDrug(option: DrugOption) {
    const newEntry: DrugEntryType = {
      drugId: option.id,
      drugName: option.name,
      dosageValue: '',
      dosageUom: option.defaultUom ?? '',
      timeAdministered: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
    onChange([...drugs, newEntry]);
    setPickingDrug(null);
    setSearch('');
  }

  function updateDrug(index: number, field: keyof DrugEntryType, val: string) {
    const updated = drugs.map((d, i) => (i === index ? { ...d, [field]: val } : d));
    onChange(updated);
  }

  function removeDrug(index: number) {
    onChange(drugs.filter((_, i) => i !== index));
  }

  return (
    <View>
      {drugs.map((drug, idx) => (
        <View key={idx} style={styles.drugRow}>
          <View style={styles.drugNameRow}>
            <Text style={styles.drugName}>{drug.drugName}</Text>
            <TouchableOpacity onPress={() => removeDrug(idx)} style={styles.removeBtn} accessibilityLabel="Remove drug">
              <Text style={styles.removeTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.drugFields}>
            <TextInput
              style={[styles.input, styles.inputDose]}
              value={drug.dosageValue}
              onChangeText={(v) => updateDrug(idx, 'dosageValue', v)}
              keyboardType="decimal-pad"
              placeholder="Dose"
              placeholderTextColor="#9ca3af"
              accessibilityLabel="Dose"
            />
            <TextInput
              style={[styles.input, styles.inputUom]}
              value={drug.dosageUom}
              onChangeText={(v) => updateDrug(idx, 'dosageUom', v)}
              placeholder="UOM"
              placeholderTextColor="#9ca3af"
              accessibilityLabel="Unit of measure"
            />
            <TextInput
              style={[styles.input, styles.inputTime]}
              value={drug.timeAdministered}
              onChangeText={(v) => updateDrug(idx, 'timeAdministered', v)}
              placeholder="HH:MM"
              placeholderTextColor="#9ca3af"
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Time administered"
            />
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={() => setPickingDrug(-1)} activeOpacity={0.7}>
        <Text style={styles.addTxt}>＋ Add Drug</Text>
      </TouchableOpacity>

      <Modal visible={pickingDrug !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setPickingDrug(null); setSearch(''); }}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Drug</Text>
            <TouchableOpacity onPress={() => { setPickingDrug(null); setSearch(''); }} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search drugs..."
            placeholderTextColor="#9ca3af"
            autoFocus
          />
          <FlatList
            data={filteredDrugs}
            keyExtractor={(d) => String(d.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.option} onPress={() => addDrug(item)} activeOpacity={0.6}>
                <Text style={styles.optionName}>{item.name}</Text>
                {item.defaultUom && <Text style={styles.optionUom}>{item.defaultUom}</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  drugRow: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  drugNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  drugName: { fontWeight: '700', fontSize: 15, color: '#111827' },
  removeBtn: { padding: 4 },
  removeTxt: { color: '#ef4444', fontSize: 16 },
  drugFields: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#111827',
    textAlign: 'center',
  },
  inputDose: { flex: 2 },
  inputUom: { flex: 1.5 },
  inputTime: { flex: 2 },
  addBtn: {
    borderWidth: 1.5,
    borderColor: '#dc2626',
    borderRadius: 10,
    borderStyle: 'dashed',
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addTxt: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
  modal: { flex: 1, backgroundColor: '#f9fafb' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    backgroundColor: '#fff',
    minHeight: 52,
  },
  optionName: { fontSize: 16, color: '#111827' },
  optionUom: { fontSize: 14, color: '#6b7280' },
});
