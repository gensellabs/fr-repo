"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LovLocationCreateSchema = exports.LovDrugCreateSchema = exports.LovUpdateSchema = exports.LovCreateSchema = exports.IncidentCreateSchema = exports.PatientSchema = exports.PatientDrugSchema = void 0;
const zod_1 = require("zod");
const constants_1 = require("../constants");
exports.PatientDrugSchema = zod_1.z.object({
    drugId: zod_1.z.number().int().positive(),
    dosageValue: zod_1.z.number().positive().nullable().optional(),
    dosageUom: zod_1.z.string().max(20).nullable().optional(),
    timeAdministered: zod_1.z.string().nullable().optional(),
});
exports.PatientSchema = zod_1.z.object({
    patientNumber: zod_1.z.number().int().min(1),
    name: zod_1.z.string().max(100).nullable().optional(),
    age: zod_1.z.number().int().min(0).max(150).nullable().optional(),
    gender: zod_1.z.enum(['Male', 'Female']).nullable().optional(),
    reasonId: zod_1.z.number().int().positive().nullable().optional(),
    colourCode: zod_1.z.enum(constants_1.COLOUR_CODES).nullable().optional(),
    medicalHistory: zod_1.z.string().max(2000).nullable().optional(),
    bpSystolic: zod_1.z.number().int().min(0).max(300).nullable().optional(),
    bpDiastolic: zod_1.z.number().int().min(0).max(200).nullable().optional(),
    gcs: zod_1.z.number().int().min(3).max(15).nullable().optional(),
    spo2: zod_1.z.number().int().min(0).max(100).nullable().optional(),
    hr: zod_1.z.number().int().min(0).max(300).nullable().optional(),
    hgt: zod_1.z.string().max(20).nullable().optional(),
    transportId: zod_1.z.number().int().positive().nullable().optional(),
    hospitalId: zod_1.z.number().int().positive().nullable().optional(),
    drugs: zod_1.z.array(exports.PatientDrugSchema).optional(),
});
exports.IncidentCreateSchema = zod_1.z.object({
    localId: zod_1.z.string().uuid().optional(),
    callTypeId: zod_1.z.number().int().positive().nullable().optional(),
    locationId: zod_1.z.number().int().positive().nullable().optional(),
    locationText: zod_1.z.string().max(25).nullable().optional(),
    patientCount: zod_1.z.number().int().min(1).max(50).default(1),
    responderIds: zod_1.z.array(zod_1.z.number().int().positive()).min(1),
    primaryResponderId: zod_1.z.number().int().positive(),
    patients: zod_1.z.array(exports.PatientSchema).optional(),
});
exports.LovCreateSchema = zod_1.z.object({
    value: zod_1.z.string().min(1).max(255).trim(),
    sortOrder: zod_1.z.number().int().min(0).optional(),
    createdBy: zod_1.z.string().max(100).optional(),
});
exports.LovUpdateSchema = zod_1.z.object({
    value: zod_1.z.string().min(1).max(255).trim().optional(),
    isActive: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().min(0).optional(),
});
exports.LovDrugCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).trim(),
    defaultUom: zod_1.z.string().max(20).nullable().optional(),
    createdBy: zod_1.z.string().max(100).optional(),
});
exports.LovLocationCreateSchema = zod_1.z.object({
    value: zod_1.z.string().min(1).max(255).trim(),
    areaId: zod_1.z.number().int().positive().nullable().optional(),
    createdBy: zod_1.z.string().max(100).optional(),
});
