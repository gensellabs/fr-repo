import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getStoredSession } from '../../store/auth';
import { useSync } from '../../hooks/useSync';
import { useCamera } from '../../hooks/useCamera';
import { LovPicker, LovOption } from '../../components/LovPicker';
import { ColourCodePicker } from '../../components/ColourCodePicker';
import { BpInput } from '../../components/BpInput';
import { DrugEntryList } from '../../components/DrugEntry';
import { api } from '../../services/api';
import {
  createNewDraft, createEmptyPatient, saveDraft, clearDraft, draftToPayload,
  IncidentDraft, PatientDraft,
} from '../../store/incidentDraft';
import { ColourCode } from '@firstresponders/shared';

const STEPS = ['Incident', 'Patients', 'Photos', 'Review'] as const;
type Step = typeof STEPS[number];

interface DrugLovItem {
  id: number;
  name: string;
  defaultUom?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export default function NewIncident() {
  const router = useRouter();
  const { saveIncident, refreshLovs } = useSync();
  const { capturePhoto } = useCamera();

  const [step, setStep] = useState<Step>('Incident');
  const [draft, setDraft] = useState<IncidentDraft | null>(null);
  const [lovs, setLovs] = useState<Record<string, LovOption[]>>({});
  const [saving, setSaving] = useState(false);
  const [currentPatient, setCurrentPatient] = useState(0);
  const [lovLoading, setLovLoading] = useState(true);

  // Load session + LOVs on mount — fetch directly from API for reliability
  useEffect(() => {
    (async () => {
      const session = await getStoredSession();
      if (!session) { router.replace('/(auth)/select-responder'); return; }

      const newDraft = createNewDraft(session.responderId, session.responderName);
      setDraft(newDraft);

      // Fetch all LOVs directly from the API (bypasses empty-cache issue)
      try {
        const [callTypes, diagnoses, transports, hospitals, responders, medHistory, drugs] =
          await Promise.all([
            api.getLov('call_types') as Promise<LovOption[]>,
            api.getLov('reasons') as Promise<LovOption[]>,
            api.getLov('transports') as Promise<LovOption[]>,
            api.getLov('hospitals') as Promise<LovOption[]>,
            api.getLov('responders') as Promise<LovOption[]>,
            api.getLov('medical_history_presets') as Promise<LovOption[]>,
            api.getLov('drugs') as Promise<DrugLovItem[]>,
          ]);

        // Drugs use 'name' field — normalise to 'value' so LovPicker & DrugEntryList work
        const drugOptions: LovOption[] = drugs.map((d) => ({
          id: d.id,
          value: d.name,
          defaultUom: d.defaultUom ?? null,
        }));

        setLovs({
          call_types: callTypes,
          reasons: diagnoses,
          transports,
          hospitals,
          responders,
          medical_history_presets: medHistory,
          drugs: drugOptions,
        });

        // Warm the offline cache in background
        refreshLovs().catch(console.error);
      } catch (err) {
        console.error('Failed to load LOVs from API:', err);
        Alert.alert('Connection Error', 'Could not load lists from server. Check your connection.');
      } finally {
        setLovLoading(false);
      }
    })();
  }, []);

  const updateDraft = useCallback((update: Partial<IncidentDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...update };
      saveDraft(next).catch(console.error);
      return next;
    });
  }, []);

  const updatePatient = useCallback((index: number, update: Partial<PatientDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const patients = prev.patients.map((p, i) => i === index ? { ...p, ...update } : p);
      const next = { ...prev, patients };
      saveDraft(next).catch(console.error);
      return next;
    });
  }, []);

  function setPatientCount(count: number) {
    if (!draft) return;
    const current = draft.patients;
    let patients: PatientDraft[];
    if (count > current.length) {
      patients = [...current, ...Array.from({ length: count - current.length }, (_, i) => createEmptyPatient(current.length + i + 1))];
    } else {
      patients = current.slice(0, count);
    }
    updateDraft({ patientCount: count, patients });
    if (currentPatient >= count) setCurrentPatient(count - 1);
  }

  async function handleCapture() {
    if (!draft) return;
    const photo = await capturePhoto(draft.patients[currentPatient]?.patientNumber);
    if (photo) updateDraft({ photos: [...draft.photos, photo] });
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = draftToPayload(draft);
      const { queued } = await saveIncident(payload, draft.photos);
      await clearDraft();
      Alert.alert(
        queued ? 'Saved Offline' : 'Incident Saved',
        queued
          ? 'No signal detected. Incident saved locally and will sync when connected.'
          : 'Incident submitted successfully.',
        [
          { text: 'New Incident', onPress: () => { setStep('Incident'); setDraft(createNewDraft(draft.primaryResponderId!, '')); } },
          { text: 'View History', onPress: () => router.push('/(tabs)/history') },
        ],
      );
    } catch (e) {
      console.error('Save error:', e);
      Alert.alert('Save Failed', 'Could not save incident. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!draft || lovLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' }}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={{ marginTop: 12, color: '#6b7280', fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  const p = draft.patients[currentPatient];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {/* Step indicator */}
      <View style={styles.stepBar}>
        {STEPS.map((s) => (
          <View key={s} style={[styles.stepDot, step === s && styles.stepDotActive, STEPS.indexOf(s) < STEPS.indexOf(step) && styles.stepDotDone]} />
        ))}
      </View>
      <Text style={styles.stepLabel}>{step}</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>

        {/* ── Step 1: Incident Header ── */}
        {step === 'Incident' && (
          <View style={styles.section}>
            <View style={styles.dateRow}>
              <Text style={styles.dateText}>
                {new Date(draft.startedAt).toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
              <Text style={styles.dateText}>
                {new Date(draft.startedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>
            </View>

            <LovPicker
              label="Call Type"
              required
              value={draft.callTypeId ? { id: draft.callTypeId, value: draft.callTypeLabel } : null}
              options={lovs['call_types'] ?? []}
              onSelect={(o) => updateDraft({ callTypeId: o.id, callTypeLabel: o.value })}
              onAddNew={async (val) => {
                const item = await api.addLovValue('call_types', val) as LovOption;
                setLovs((l) => ({ ...l, call_types: [...(l['call_types'] ?? []), item] }));
                return item;
              }}
            />


            <Text style={styles.fieldLabel}>
              Location <Text style={{ color: '#9ca3af', fontWeight: '400' }}>(optional, max 25 chars)</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Main Rd intersection"
              placeholderTextColor="#9ca3af"
              value={draft.locationText}
              onChangeText={(v) => updateDraft({ locationText: v.slice(0, 25) })}
              maxLength={25}
              autoCapitalize="sentences"
            />
            <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, textAlign: 'right' }}>
              {draft.locationText?.length ?? 0}/25
            </Text>

            <Text style={styles.fieldLabel}>Responders on Scene</Text>
            <View style={styles.chipRow}>
              {(lovs['responders'] ?? []).map((r) => {
                const selected = draft.responderIds.includes(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => {
                      const ids = selected
                        ? draft.responderIds.filter((id) => id !== r.id)
                        : [...draft.responderIds, r.id];
                      const labels = (lovs['responders'] ?? []).filter((x) => ids.includes(x.id)).map((x) => x.value);
                      updateDraft({ responderIds: ids, responderLabels: labels });
                    }}
                    disabled={r.id === draft.primaryResponderId}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{r.value}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 2: Patients ── */}
        {step === 'Patients' && (
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Number of Patients</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setPatientCount(Math.max(1, draft.patientCount - 1))}>
                <Text style={styles.stepBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepCount}>{draft.patientCount}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setPatientCount(draft.patientCount + 1)}>
                <Text style={styles.stepBtnTxt}>＋</Text>
              </TouchableOpacity>
            </View>

            {draft.patients.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientTabs}>
                {draft.patients.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.patientTab, currentPatient === i && styles.patientTabActive]}
                    onPress={() => setCurrentPatient(i)}
                  >
                    <Text style={[styles.patientTabTxt, currentPatient === i && styles.patientTabTxtActive]}>
                      Patient {i + 1}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.patientCard}>
              <Text style={styles.cardTitle}>Patient {p.patientNumber}</Text>

              {/* Name */}
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Patient name (optional)"
                placeholderTextColor="#9ca3af"
                value={p.name}
                onChangeText={(v) => updatePatient(currentPatient, { name: v })}
                autoCapitalize="words"
              />

              {/* Age & Gender row */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Age (years)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 45"
                    placeholderTextColor="#9ca3af"
                    value={p.age}
                    onChangeText={(v) => updatePatient(currentPatient, { age: v.replace(/[^0-9]/g, '') })}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Gender</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {(['Male', 'Female'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.genderBtn, p.gender === g && styles.genderBtnActive]}
                        onPress={() => updatePatient(currentPatient, { gender: p.gender === g ? null : g })}
                      >
                        <Text style={[styles.genderBtnTxt, p.gender === g && styles.genderBtnTxtActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <LovPicker
                label="Diagnosis"
                value={p.reasonId ? { id: p.reasonId, value: p.reasonLabel } : null}
                options={lovs['reasons'] ?? []}
                onSelect={(o) => updatePatient(currentPatient, { reasonId: o.id, reasonLabel: o.value })}
                onAddNew={async (val) => {
                  const item = await api.addLovValue('reasons', val) as LovOption;
                  setLovs((l) => ({ ...l, reasons: [...(l['reasons'] ?? []), item] }));
                  return item;
                }}
              />

              <View style={styles.fieldGap} />
              <Text style={styles.fieldLabel}>Triage Colour Code</Text>
              <ColourCodePicker
                value={p.colourCode}
                onChange={(code: ColourCode) => updatePatient(currentPatient, { colourCode: code })}
              />

              <View style={styles.fieldGap} />
              <Text style={styles.fieldLabel}>Blood Pressure</Text>
              <BpInput
                systolic={p.bpSystolic}
                diastolic={p.bpDiastolic}
                onChangeSystolic={(v) => updatePatient(currentPatient, { bpSystolic: v })}
                onChangeDiastolic={(v) => updatePatient(currentPatient, { bpDiastolic: v })}
              />

              <View style={styles.vitalsRow}>
                {([['GCS', 'gcs', '3–15'], ['SpO2', 'spo2', '%'], ['HR', 'hr', 'bpm'], ['HGT', 'hgt', 'mmol/L']] as [string, keyof PatientDraft, string][]).map(([lbl, field, unit]) => (
                  <View key={field} style={styles.vitalItem}>
                    <Text style={styles.vitalLabel}>{lbl}</Text>
                    <TextInput
                      style={styles.vitalInput}
                      value={String(p[field] ?? '')}
                      onChangeText={(v) => updatePatient(currentPatient, { [field]: v })}
                      keyboardType={field === 'hgt' ? 'decimal-pad' : 'number-pad'}
                      placeholder={unit}
                      placeholderTextColor="#9ca3af"
                      accessibilityLabel={lbl}
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Medical History</Text>
              {(lovs['medical_history_presets'] ?? []).length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  <View style={styles.chipRow}>
                    {(lovs['medical_history_presets'] ?? []).map((preset) => {
                      const selected = p.medicalHistory.includes(preset.value);
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            const parts = p.medicalHistory ? p.medicalHistory.split(', ').filter(Boolean) : [];
                            const next = selected
                              ? parts.filter((x) => x !== preset.value)
                              : [...parts, preset.value];
                            updatePatient(currentPatient, { medicalHistory: next.join(', ') });
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{preset.value}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
              <TextInput
                style={styles.textArea}
                value={p.medicalHistory}
                onChangeText={(v) => updatePatient(currentPatient, { medicalHistory: v })}
                placeholder="Additional medical history..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={2}
              />

              <Text style={styles.fieldLabel}>Drugs Administered</Text>
              <DrugEntryList
                drugs={p.drugs}
                drugOptions={(lovs['drugs'] ?? []).map((d) => ({
                  id: d.id,
                  name: d.value,
                  defaultUom: (d as { defaultUom?: string | null }).defaultUom ?? null,
                }))}
                onChange={(drugs) => updatePatient(currentPatient, { drugs })}
              />

              <LovPicker
                label="Transport"
                value={p.transportId ? { id: p.transportId, value: p.transportLabel } : null}
                options={lovs['transports'] ?? []}
                onSelect={(o) => updatePatient(currentPatient, { transportId: o.id, transportLabel: o.value })}
                onAddNew={async (val) => {
                  const item = await api.addLovValue('transports', val) as LovOption;
                  setLovs((l) => ({ ...l, transports: [...(l['transports'] ?? []), item] }));
                  return item;
                }}
              />

              <LovPicker
                label="Hospital"
                value={p.hospitalId ? { id: p.hospitalId, value: p.hospitalLabel } : null}
                options={lovs['hospitals'] ?? []}
                onSelect={(o) => updatePatient(currentPatient, { hospitalId: o.id, hospitalLabel: o.value })}
                onAddNew={async (val) => {
                  const item = await api.addLovValue('hospitals', val) as LovOption;
                  setLovs((l) => ({ ...l, hospitals: [...(l['hospitals'] ?? []), item] }));
                  return item;
                }}
              />
            </View>
          </View>
        )}

        {/* ── Step 3: Photos ── */}
        {step === 'Photos' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.cameraBtn} onPress={handleCapture} activeOpacity={0.7}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.cameraTxt}>Capture Scene Photo</Text>
              <Text style={styles.cameraHint}>GPS will be tagged automatically</Text>
            </TouchableOpacity>

            <View style={styles.photoGrid}>
              {draft.photos.map((photo, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri: photo.uri }} style={styles.thumbImg} />
                  {photo.latitude && (
                    <Text style={styles.thumbGps}>
                      📍 {photo.latitude.toFixed(4)}, {photo.longitude?.toFixed(4)}
                      {photo.altitude != null ? `\n⬆ ${Math.round(photo.altitude)}m` : ''}
                    </Text>
                  )}
                  {photo.patientNumber && (
                    <Text style={styles.thumbPatient}>P{photo.patientNumber}</Text>
                  )}
                </View>
              ))}
            </View>
            {draft.photos.length === 0 && (
              <Text style={styles.noPhotos}>No photos yet. Tap above to capture.</Text>
            )}
          </View>
        )}

        {/* ── Step 4: Review ── */}
        {step === 'Review' && (
          <View style={styles.section}>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>Incident Summary</Text>
              <Row label="Date/Time" value={`${new Date(draft.startedAt).toLocaleDateString('en-ZA')} ${new Date(draft.startedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}`} />
              <Row label="Call Type" value={draft.callTypeLabel || '—'} />
              <Row label="Location" value={[draft.areaLabel, draft.locationLabel].filter(Boolean).join(' › ') || '—'} />
              <Row label="Responders" value={draft.responderLabels.join(', ') || '—'} />
              <Row label="Patients" value={String(draft.patientCount)} />
              <Row label="Photos" value={String(draft.photos.length)} />
            </View>

            {draft.patients.map((patient, i) => (
              <View key={i} style={styles.reviewCard}>
                <Text style={styles.reviewTitle}>Patient {patient.patientNumber}</Text>
                {patient.name ? <Row label="Name" value={patient.name} /> : null}
                {patient.age ? <Row label="Age" value={`${patient.age} years`} /> : null}
                {patient.gender ? <Row label="Gender" value={patient.gender} /> : null}
                {patient.reasonLabel ? <Row label="Diagnosis" value={patient.reasonLabel} /> : null}
                {patient.colourCode && <Row label="Colour Code" value={patient.colourCode} />}
                {(patient.bpSystolic || patient.bpDiastolic) && (
                  <Row label="BP" value={`${patient.bpSystolic || '?'}/${patient.bpDiastolic || '?'} mmHg`} />
                )}
                {patient.gcs && <Row label="GCS" value={patient.gcs} />}
                {patient.spo2 && <Row label="SpO2" value={`${patient.spo2}%`} />}
                {patient.hr && <Row label="HR" value={`${patient.hr} bpm`} />}
                {patient.hgt && patient.hgt !== 'N/A' && <Row label="HGT" value={patient.hgt} />}
                {patient.medicalHistory && <Row label="Medical History" value={patient.medicalHistory} />}
                {patient.drugs.length > 0 && (
                  <Row label="Drugs" value={patient.drugs.map((d) => `${d.drugName} ${d.dosageValue}${d.dosageUom}`).join(', ')} />
                )}
                {patient.transportLabel && <Row label="Transport" value={patient.transportLabel} />}
                {patient.hospitalLabel && <Row label="Hospital" value={patient.hospitalLabel} />}
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.footer}>
        {step !== 'Incident' && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep(STEPS[STEPS.indexOf(step) - 1])}
          >
            <Text style={styles.backTxt}>← Back</Text>
          </TouchableOpacity>
        )}
        {step !== 'Review' ? (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => setStep(STEPS[STEPS.indexOf(step) + 1])}
          >
            <Text style={styles.nextTxt}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.nextBtn, styles.saveBtn]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextTxt}>💾 Save Incident</Text>}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  stepBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e5e7eb' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d1d5db' },
  stepDotActive: { backgroundColor: '#dc2626', transform: [{ scale: 1.3 }] },
  stepDotDone: { backgroundColor: '#fca5a5' },
  stepLabel: { textAlign: 'center', fontSize: 13, color: '#6b7280', paddingBottom: 4, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 80 },
  section: { gap: 12 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  dateText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 4 },
  fieldGap: { height: 8 },
  chipScroll: { maxHeight: 80 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', minHeight: 40, justifyContent: 'center' },
  chipSelected: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextSelected: { color: '#dc2626', fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fca5a5' },
  stepBtnTxt: { fontSize: 26, fontWeight: '700', color: '#dc2626' },
  stepCount: { fontSize: 36, fontWeight: '800', color: '#111827', minWidth: 50, textAlign: 'center' },
  patientTabs: { maxHeight: 48 },
  patientTab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8, backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#e5e7eb' },
  patientTabActive: { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  patientTabTxt: { fontWeight: '600', color: '#6b7280' },
  patientTabTxtActive: { color: '#dc2626' },
  patientCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  textInput: { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff', color: '#111827', marginTop: 4 },
  genderBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff', alignItems: 'center' },
  genderBtnActive: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  genderBtnTxt: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  genderBtnTxtActive: { color: '#dc2626' },
  vitalsRow: { flexDirection: 'row', gap: 10 },
  vitalItem: { flex: 1, alignItems: 'center' },
  vitalLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  vitalInput: { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 10, textAlign: 'center', fontSize: 16, fontWeight: '600', width: '100%', backgroundColor: '#fff', color: '#111827' },
  textArea: { borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 15, minHeight: 60, backgroundColor: '#fff', color: '#111827' },
  cameraBtn: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 32, borderWidth: 2, borderColor: '#dc2626', borderStyle: 'dashed' },
  cameraIcon: { fontSize: 48 },
  cameraTxt: { fontSize: 18, fontWeight: '700', color: '#dc2626', marginTop: 8 },
  cameraHint: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  photoThumb: { width: '47%', borderRadius: 10, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  thumbImg: { width: '100%', height: 120 },
  thumbGps: { fontSize: 10, color: '#6b7280', padding: 4 },
  thumbPatient: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(220,38,38,0.85)', color: '#fff', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  noPhotos: { textAlign: 'center', color: '#9ca3af', fontSize: 15, marginTop: 24 },
  reviewCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  reviewTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12, borderBottomWidth: 1, borderColor: '#f3f4f6', paddingBottom: 8 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f9fafb' },
  reviewLabel: { fontSize: 14, color: '#6b7280', flex: 1 },
  reviewValue: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 2, textAlign: 'right' },
  footer: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e5e7eb' },
  backBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#d1d5db', alignItems: 'center' },
  backTxt: { fontSize: 16, fontWeight: '600', color: '#374151' },
  nextBtn: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: '#dc2626', alignItems: 'center' },
  saveBtn: { backgroundColor: '#16a34a' },
  nextTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
