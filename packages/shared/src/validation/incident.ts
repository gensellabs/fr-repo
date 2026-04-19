import { z } from 'zod';
import { COLOUR_CODES } from '../constants';

export const PatientDrugSchema = z.object({
  drugId: z.number().int().positive(),
  dosageValue: z.number().positive().nullable().optional(),
  dosageUom: z.string().max(20).nullable().optional(),
  timeAdministered: z.string().nullable().optional(),
});

export const PatientSchema = z.object({
  patientNumber: z.number().int().min(1),
  name: z.string().max(100).nullable().optional(),
  age: z.number().int().min(0).max(150).nullable().optional(),
  gender: z.enum(['Male', 'Female']).nullable().optional(),
  reasonId: z.number().int().positive().nullable().optional(),
  colourCode: z.enum(COLOUR_CODES).nullable().optional(),
  medicalHistory: z.string().max(2000).nullable().optional(),
  bpSystolic: z.number().int().min(0).max(300).nullable().optional(),
  bpDiastolic: z.number().int().min(0).max(200).nullable().optional(),
  gcs: z.number().int().min(3).max(15).nullable().optional(),
  spo2: z.number().int().min(0).max(100).nullable().optional(),
  hr: z.number().int().min(0).max(300).nullable().optional(),
  hgt: z.string().max(20).nullable().optional(),
  transportId: z.number().int().positive().nullable().optional(),
  hospitalId: z.number().int().positive().nullable().optional(),
  drugs: z.array(PatientDrugSchema).optional(),
});

export const IncidentCreateSchema = z.object({
  localId: z.string().uuid().optional(),
  callTypeId: z.number().int().positive().nullable().optional(),
  locationId: z.number().int().positive().nullable().optional(),
  locationText: z.string().max(25).nullable().optional(),
  patientCount: z.number().int().min(1).max(50).default(1),
  responderIds: z.array(z.number().int().positive()).min(1),
  primaryResponderId: z.number().int().positive(),
  patients: z.array(PatientSchema).optional(),
});

export const LovCreateSchema = z.object({
  value: z.string().min(1).max(255).trim(),
  sortOrder: z.number().int().min(0).optional(),
  createdBy: z.string().max(100).optional(),
});

export const LovUpdateSchema = z.object({
  value: z.string().min(1).max(255).trim().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const LovDrugCreateSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  defaultUom: z.string().max(20).nullable().optional(),
  createdBy: z.string().max(100).optional(),
});

export const LovLocationCreateSchema = z.object({
  value: z.string().min(1).max(255).trim(),
  areaId: z.number().int().positive().nullable().optional(),
  createdBy: z.string().max(100).optional(),
});
