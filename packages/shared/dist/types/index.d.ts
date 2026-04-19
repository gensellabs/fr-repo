import { ColourCode } from '../constants';
export interface LovItem {
    id: number;
    value: string;
    isActive: boolean;
    sortOrder?: number;
    createdAt?: string;
    createdBy?: string;
}
export interface LovDrugItem extends LovItem {
    defaultUom: string | null;
}
export interface LovAreaItem extends LovItem {
    locations?: LovLocationItem[];
}
export interface LovLocationItem extends LovItem {
    areaId: number | null;
    area?: LovAreaItem;
}
export interface Incident {
    id: number;
    localId?: string;
    incidentDate: string;
    callTypeId: number | null;
    callType?: LovItem;
    locationId: number | null;
    location?: LovLocationItem;
    locationText?: string | null;
    patientCount: number;
    patients: Patient[];
    responders: IncidentResponder[];
    photos: IncidentPhoto[];
    syncedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface IncidentCreateInput {
    localId?: string;
    callTypeId?: number | null;
    locationId?: number | null;
    locationText?: string | null;
    patientCount?: number;
    responderIds?: number[];
    primaryResponderId?: number;
    patients?: PatientCreateInput[];
}
export interface Patient {
    id: number;
    incidentId: number;
    patientNumber: number;
    colourCode: ColourCode | null;
    medicalHistory: string | null;
    bpSystolic: number | null;
    bpDiastolic: number | null;
    gcs: number | null;
    spo2: number | null;
    hr: number | null;
    hgt: string | null;
    transportId: number | null;
    transport?: LovItem;
    hospitalId: number | null;
    hospital?: LovItem;
    drugs: PatientDrug[];
    photos?: IncidentPhoto[];
}
export interface PatientCreateInput {
    patientNumber: number;
    colourCode?: ColourCode | null;
    medicalHistory?: string | null;
    bpSystolic?: number | null;
    bpDiastolic?: number | null;
    gcs?: number | null;
    spo2?: number | null;
    hr?: number | null;
    hgt?: string | null;
    transportId?: number | null;
    hospitalId?: number | null;
    drugs?: PatientDrugInput[];
}
export interface PatientDrug {
    id: number;
    patientId: number;
    drugId: number;
    drug?: LovDrugItem;
    dosageValue: number | null;
    dosageUom: string | null;
    timeAdministered: string | null;
}
export interface PatientDrugInput {
    drugId: number;
    dosageValue?: number | null;
    dosageUom?: string | null;
    timeAdministered?: string | null;
}
export interface IncidentResponder {
    id: number;
    incidentId: number;
    responderId: number;
    responder?: LovResponderItem;
    isPrimary: boolean;
}
export interface LovResponderItem extends LovItem {
    firstName?: string | null;
    surname?: string | null;
    username?: string | null;
    email?: string | null;
    mobile?: string | null;
    isAdmin: boolean;
    isSysAdmin?: boolean;
    role?: string;
}
export interface IncidentPhoto {
    id: number;
    incidentId: number;
    patientId: number | null;
    storagePath: string;
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
    capturedAt: string;
    capturedBy: number;
    responder?: LovItem;
}
export interface AuditLogEntry {
    id: number;
    tableName: string;
    recordId: number;
    action: 'CREATE' | 'UPDATE' | 'DEACTIVATE';
    oldValue: string | null;
    newValue: string | null;
    changedBy: string;
    changedAt: string;
}
export interface AuthSession {
    responderId: number;
    responderName: string;
    isAdmin: boolean;
    token: string;
}
