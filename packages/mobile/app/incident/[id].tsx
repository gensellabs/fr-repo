import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../../services/api';
import { COLOUR_CODE_STYLES } from '@firstresponders/shared';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Drug {
  drug: { name: string };
  dosageValue: string;
  dosageUom: string;
}
interface Photo {
  id: number;
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
}
interface Patient {
  id: number;
  patientNumber: number;
  name?: string | null;
  age?: string | null;
  gender?: string | null;
  colourCode?: string | null;
  bpSystolic?: string | null;
  bpDiastolic?: string | null;
  gcs?: string | null;
  spo2?: string | null;
  hr?: string | null;
  hgt?: string | null;
  medicalHistory?: string | null;
  reason?: { value: string } | null;
  transport?: { value: string } | null;
  hospital?: { value: string } | null;
  drugs: Drug[];
  photos: Photo[];
}
interface FullIncident {
  id: number;
  incidentDate: string;
  notes?: string | null;
  callType?: { value: string } | null;
  location?: { value: string; area?: { value: string } | null } | null;
  organisation?: { name: string } | null;
  responders: Array<{ responder: { value: string } }>;
  photos: Photo[];
  patients: Patient[];
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function IncidentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [incident, setIncident] = useState<FullIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Photo URIs keyed by photo ID — stored in parent so they survive any re-render
  const [photoUris, setPhotoUris] = useState<Record<number, string | 'error'>>({});
  const photoLoadStarted = useRef(false);

  useEffect(() => {
    if (!id) return;
    api.getIncident(Number(id))
      .then((data) => {
        const inc = data as FullIncident;
        setIncident(inc);
        const callLabel = inc.callType?.value ?? 'Incident';
        const dateLabel = new Date(inc.incidentDate).toLocaleDateString('en-ZA', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
        navigation.setOptions({ title: `${callLabel} · ${dateLabel}` });
      })
      .catch(() => setError('Could not load incident. Check your connection.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Once incident is loaded, download each photo to device cache and store local URI
  useEffect(() => {
    if (!incident || photoLoadStarted.current) return;
    photoLoadStarted.current = true;

    const allIds = [
      ...incident.photos,
      ...incident.patients.flatMap((p) => p.photos),
    ].map((p) => p.id);

    console.log(`[Photos] Loading ${allIds.length} photo(s):`, allIds);

    allIds.forEach(async (photoId) => {
      try {
        const token = await SecureStore.getItemAsync('auth_token');
        const localUri = `${FileSystem.cacheDirectory}photo_${photoId}.jpg`;

        // Use cached file if already downloaded
        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) {
          console.log(`[Photos] Cache hit: photo ${photoId}`);
          setPhotoUris((prev) => ({ ...prev, [photoId]: localUri }));
          return;
        }

        console.log(`[Photos] Downloading photo ${photoId}`);
        const result = await FileSystem.downloadAsync(
          `${BASE_URL}/api/photos/${photoId}`,
          localUri,
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        );
        console.log(`[Photos] Done photo ${photoId}, status=${result.status}`);

        if (result.status === 200) {
          setPhotoUris((prev) => ({ ...prev, [photoId]: result.uri }));
        } else {
          setPhotoUris((prev) => ({ ...prev, [photoId]: 'error' }));
        }
      } catch (e) {
        console.log(`[Photos] Error photo ${photoId}:`, e);
        setPhotoUris((prev) => ({ ...prev, [photoId]: 'error' }));
      }
    });
  }, [incident]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }
  if (error || !incident) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>{error || 'Incident not found.'}</Text>
      </View>
    );
  }

  const allPhotos = [
    ...incident.photos,
    ...incident.patients.flatMap((p) => p.photos),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Incident header ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Incident</Text>
          <Row label="Date" value={new Date(incident.incidentDate).toLocaleDateString('en-ZA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} />
          <Row label="Time" value={new Date(incident.incidentDate).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })} />
          {incident.callType && <Row label="Call Type" value={incident.callType.value} />}
          {incident.location && (
            <Row
              label="Location"
              value={[incident.location.area?.value, incident.location.value].filter(Boolean).join(' › ')}
            />
          )}
          {incident.organisation && <Row label="Organisation" value={incident.organisation.name} />}
          {incident.responders.length > 0 && (
            <Row label="Responders" value={incident.responders.map((r) => r.responder.value).join(', ')} />
          )}
          <Row label="Patients" value={String(incident.patients.length)} />
          <Row label="Photos" value={String(allPhotos.length)} />
          {incident.notes && <Row label="Notes" value={incident.notes} />}
        </View>

        {/* ── Patients ── */}
        {incident.patients.map((patient) => {
          const codeStyle = patient.colourCode
            ? COLOUR_CODE_STYLES[patient.colourCode as keyof typeof COLOUR_CODE_STYLES]
            : null;

          return (
            <View key={patient.id} style={styles.card}>
              {/* Colour code bar */}
              {codeStyle && (
                <View style={[styles.codeBar, { backgroundColor: codeStyle.bg }]}>
                  <Text style={[styles.codeLabel, { color: codeStyle.text }]}>
                    {patient.colourCode} Code
                  </Text>
                </View>
              )}

              <Text style={styles.cardTitle}>Patient {patient.patientNumber}</Text>

              {patient.name       && <Row label="Name"       value={patient.name} />}
              {patient.age        && <Row label="Age"        value={`${patient.age} years`} />}
              {patient.gender     && <Row label="Gender"     value={patient.gender} />}
              {patient.reason     && <Row label="Diagnosis"  value={patient.reason.value} />}

              {/* Vitals */}
              {(patient.bpSystolic || patient.bpDiastolic) && (
                <Row label="BP" value={`${patient.bpSystolic || '?'} / ${patient.bpDiastolic || '?'} mmHg`} />
              )}
              {patient.gcs  && <Row label="GCS"  value={patient.gcs} />}
              {patient.spo2 && <Row label="SpO2" value={`${patient.spo2}%`} />}
              {patient.hr   && <Row label="HR"   value={`${patient.hr} bpm`} />}
              {patient.hgt && patient.hgt !== 'N/A' && (
                <Row label="HGT" value={`${patient.hgt} mmol/L`} />
              )}

              {patient.medicalHistory && (
                <Row label="Medical History" value={patient.medicalHistory} />
              )}

              {/* Drugs */}
              {patient.drugs.length > 0 && (
                <View style={styles.subSection}>
                  <Text style={styles.subTitle}>Drugs Administered</Text>
                  {patient.drugs.map((d, i) => (
                    <View key={i} style={styles.drugRow}>
                      <Text style={styles.drugName}>{d.drug.name}</Text>
                      <Text style={styles.drugDose}>{d.dosageValue} {d.dosageUom}</Text>
                    </View>
                  ))}
                </View>
              )}

              {patient.transport && <Row label="Transport" value={patient.transport.value} />}
              {patient.hospital  && <Row label="Hospital"  value={patient.hospital.value} />}
            </View>
          );
        })}

        {/* ── Photos ── */}
        {allPhotos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Photos ({allPhotos.length})</Text>
            <View style={styles.photoGrid}>
              {allPhotos.map((photo) => {
                const uri = photoUris[photo.id];
                if (uri === 'error') {
                  return (
                    <View key={photo.id} style={photoStyles.placeholder}>
                      <Text style={{ fontSize: 24 }}>🖼️</Text>
                    </View>
                  );
                }
                if (!uri) {
                  return (
                    <View key={photo.id} style={photoStyles.placeholder}>
                      <ActivityIndicator size="small" color="#dc2626" />
                    </View>
                  );
                }
                return (
                  <Image
                    key={photo.id}
                    source={{ uri }}
                    style={photoStyles.thumb}
                    resizeMode="cover"
                    onLoad={() => console.log(`[Photos] displayed ${photo.id}`)}
                    onError={(e) => console.log(`[Photos] Image error ${photo.id}:`, e.nativeEvent.error, 'uri=', uri?.slice(0, 60))}
                  />
                );
              })}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Explicit pixel dimensions — percentage widths on Image inside flexWrap are unreliable in RN
const SCREEN_W = Dimensions.get('window').width;
const PHOTO_W  = SCREEN_W - 24 - 32; // full card width (content padding 12×2 + card padding 16×2)
const PHOTO_H  = Math.floor(PHOTO_W * 3 / 4);

const photoStyles = StyleSheet.create({
  placeholder: {
    width: PHOTO_W, height: PHOTO_H, backgroundColor: '#f3f4f6',
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  thumb: { width: PHOTO_W, height: PHOTO_H, borderRadius: 10 },
});

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#f3f4f6' },
  content:   { padding: 12, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardTitle: {
    fontSize: 16, fontWeight: '700', color: '#111827',
    marginBottom: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  codeBar: {
    marginHorizontal: -16, marginTop: -16, marginBottom: 12,
    paddingVertical: 6, paddingHorizontal: 16, borderRadius: 13,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
  },
  codeLabel:  { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  rowLabel:  { fontSize: 14, color: '#6b7280', flex: 1 },
  rowValue:  { fontSize: 14, fontWeight: '600', color: '#111827', flex: 2, textAlign: 'right' },
  subSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  subTitle:   { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  drugRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 5, paddingHorizontal: 8,
    backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 4,
  },
  drugName:  { fontSize: 14, color: '#374151', fontWeight: '600' },
  drugDose:  { fontSize: 14, color: '#6b7280' },
  photoGrid: { gap: 10, marginTop: 4 },
});
