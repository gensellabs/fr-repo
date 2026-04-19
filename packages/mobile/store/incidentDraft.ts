/**
 * In-memory draft store for the active incident being captured.
 * On save, the draft is submitted to the API (or queued offline).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColourCode } from '@firstresponders/shared';

// Pure-JS UUID v4 — no native modules needed
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface DrugEntry {
  drugId: number;
  drugName: string;
  dosageValue: string;
  dosageUom: string;
  timeAdministered: string;  // HH:MM
}

export interface PhotoEntry {
  uri: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  capturedAt: string;
  patientNumber?: number;
  uploaded?: boolean;   // true once server confirmed receipt
}

export interface PatientDraft {
  patientNumber: number;
  name: string;
  age: string;
  gender: 'Male' | 'Female' | null;
  reasonId: number | null;
  reasonLabel: string;
  colourCode: ColourCode | null;
  medicalHistory: string;
  bpSystolic: string;
  bpDiastolic: string;
  gcs: string;
  spo2: string;
  hr: string;
  hgt: string;
  transportId: number | null;
  transportLabel: string;
  hospitalId: number | null;
  hospitalLabel: string;
  drugs: DrugEntry[];
}

export interface IncidentDraft {
  localId: string;
  callTypeId: number | null;
  callTypeLabel: string;
  locationText: string;
  patientCount: number;
  responderIds: number[];
  responderLabels: string[];
  primaryResponderId: number | null;
  patients: PatientDraft[];
  photos: PhotoEntry[];
  startedAt: string;
}

const DRAFT_KEY = 'incident_draft';

export function createEmptyPatient(patientNumber: number): PatientDraft {
  return {
    patientNumber,
    name: '',
    age: '',
    gender: null,
    reasonId: null,
    reasonLabel: '',
    colourCode: null,
    medicalHistory: '',
    bpSystolic: '',
    bpDiastolic: '',
    gcs: '',
    spo2: '',
    hr: '',
    hgt: 'N/A',
    transportId: null,
    transportLabel: '',
    hospitalId: null,
    hospitalLabel: '',
    drugs: [],
  };
}

export function createNewDraft(primaryResponderId: number, responderLabel: string): IncidentDraft {
  return {
    localId: uuidv4(),
    callTypeId: null,
    callTypeLabel: '',
    locationText: '',
    patientCount: 1,
    responderIds: [primaryResponderId],
    responderLabels: [responderLabel],
    primaryResponderId,
    patients: [createEmptyPatient(1)],
    photos: [],
    startedAt: new Date().toISOString(),
  };
}

export async function saveDraft(draft: IncidentDraft): Promise<void> {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function loadDraft(): Promise<IncidentDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as IncidentDraft) : null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY);
}

/** Convert draft to API payload */
export function draftToPayload(draft: IncidentDraft) {
  return {
    localId: draft.localId,
    callTypeId: draft.callTypeId,
    locationText: draft.locationText?.trim() || null,
    patientCount: draft.patientCount,
    responderIds: draft.responderIds,
    primaryResponderId: draft.primaryResponderId,
    patients: draft.patients.map((p) => ({
      patientNumber: p.patientNumber,
      name: p.name || null,
      age: p.age ? parseInt(p.age, 10) : null,
      gender: p.gender ?? null,
      reasonId: p.reasonId ?? null,
      colourCode: p.colourCode,
      medicalHistory: p.medicalHistory || null,
      bpSystolic: p.bpSystolic ? parseInt(p.bpSystolic, 10) : null,
      bpDiastolic: p.bpDiastolic ? parseInt(p.bpDiastolic, 10) : null,
      gcs: p.gcs ? parseInt(p.gcs, 10) : null,
      spo2: p.spo2 ? parseInt(p.spo2, 10) : null,
      hr: p.hr ? parseInt(p.hr, 10) : null,
      hgt: p.hgt || null,
      transportId: p.transportId,
      hospitalId: p.hospitalId,
      drugs: p.drugs.map((d) => ({
        drugId: d.drugId,
        dosageValue: d.dosageValue ? parseFloat(d.dosageValue) : null,
        dosageUom: d.dosageUom || null,
        timeAdministered: d.timeAdministered || null,
      })),
    })),
  };
}
