import { z } from 'zod';
export declare const PatientDrugSchema: z.ZodObject<{
    drugId: z.ZodNumber;
    dosageValue: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    dosageUom: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timeAdministered: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    drugId: number;
    dosageValue?: number | null | undefined;
    dosageUom?: string | null | undefined;
    timeAdministered?: string | null | undefined;
}, {
    drugId: number;
    dosageValue?: number | null | undefined;
    dosageUom?: string | null | undefined;
    timeAdministered?: string | null | undefined;
}>;
export declare const PatientSchema: z.ZodObject<{
    patientNumber: z.ZodNumber;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    age: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    gender: z.ZodOptional<z.ZodNullable<z.ZodEnum<["Male", "Female"]>>>;
    reasonId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    colourCode: z.ZodOptional<z.ZodNullable<z.ZodEnum<["Green", "Yellow", "Orange", "Red", "Blue"]>>>;
    medicalHistory: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    bpSystolic: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    bpDiastolic: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    gcs: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    spo2: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    hr: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    hgt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    transportId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    hospitalId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    drugs: z.ZodOptional<z.ZodArray<z.ZodObject<{
        drugId: z.ZodNumber;
        dosageValue: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        dosageUom: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        timeAdministered: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        drugId: number;
        dosageValue?: number | null | undefined;
        dosageUom?: string | null | undefined;
        timeAdministered?: string | null | undefined;
    }, {
        drugId: number;
        dosageValue?: number | null | undefined;
        dosageUom?: string | null | undefined;
        timeAdministered?: string | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    patientNumber: number;
    drugs?: {
        drugId: number;
        dosageValue?: number | null | undefined;
        dosageUom?: string | null | undefined;
        timeAdministered?: string | null | undefined;
    }[] | undefined;
    name?: string | null | undefined;
    age?: number | null | undefined;
    gender?: "Male" | "Female" | null | undefined;
    reasonId?: number | null | undefined;
    colourCode?: "Green" | "Yellow" | "Orange" | "Red" | "Blue" | null | undefined;
    medicalHistory?: string | null | undefined;
    bpSystolic?: number | null | undefined;
    bpDiastolic?: number | null | undefined;
    gcs?: number | null | undefined;
    spo2?: number | null | undefined;
    hr?: number | null | undefined;
    hgt?: string | null | undefined;
    transportId?: number | null | undefined;
    hospitalId?: number | null | undefined;
}, {
    patientNumber: number;
    drugs?: {
        drugId: number;
        dosageValue?: number | null | undefined;
        dosageUom?: string | null | undefined;
        timeAdministered?: string | null | undefined;
    }[] | undefined;
    name?: string | null | undefined;
    age?: number | null | undefined;
    gender?: "Male" | "Female" | null | undefined;
    reasonId?: number | null | undefined;
    colourCode?: "Green" | "Yellow" | "Orange" | "Red" | "Blue" | null | undefined;
    medicalHistory?: string | null | undefined;
    bpSystolic?: number | null | undefined;
    bpDiastolic?: number | null | undefined;
    gcs?: number | null | undefined;
    spo2?: number | null | undefined;
    hr?: number | null | undefined;
    hgt?: string | null | undefined;
    transportId?: number | null | undefined;
    hospitalId?: number | null | undefined;
}>;
export declare const IncidentCreateSchema: z.ZodObject<{
    localId: z.ZodOptional<z.ZodString>;
    callTypeId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    locationId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    patientCount: z.ZodDefault<z.ZodNumber>;
    responderIds: z.ZodArray<z.ZodNumber, "many">;
    primaryResponderId: z.ZodNumber;
    patients: z.ZodOptional<z.ZodArray<z.ZodObject<{
        patientNumber: z.ZodNumber;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        age: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        gender: z.ZodOptional<z.ZodNullable<z.ZodEnum<["Male", "Female"]>>>;
        reasonId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        colourCode: z.ZodOptional<z.ZodNullable<z.ZodEnum<["Green", "Yellow", "Orange", "Red", "Blue"]>>>;
        medicalHistory: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bpSystolic: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        bpDiastolic: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        gcs: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        spo2: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        hr: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        hgt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        transportId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        hospitalId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        drugs: z.ZodOptional<z.ZodArray<z.ZodObject<{
            drugId: z.ZodNumber;
            dosageValue: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            dosageUom: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            timeAdministered: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            drugId: number;
            dosageValue?: number | null | undefined;
            dosageUom?: string | null | undefined;
            timeAdministered?: string | null | undefined;
        }, {
            drugId: number;
            dosageValue?: number | null | undefined;
            dosageUom?: string | null | undefined;
            timeAdministered?: string | null | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        patientNumber: number;
        drugs?: {
            drugId: number;
            dosageValue?: number | null | undefined;
            dosageUom?: string | null | undefined;
            timeAdministered?: string | null | undefined;
        }[] | undefined;
        name?: string | null | undefined;
        age?: number | null | undefined;
        gender?: "Male" | "Female" | null | undefined;
        reasonId?: number | null | undefined;
        colourCode?: "Green" | "Yellow" | "Orange" | "Red" | "Blue" | null | undefined;
        medicalHistory?: string | null | undefined;
        bpSystolic?: number | null | undefined;
        bpDiastolic?: number | null | undefined;
        gcs?: number | null | undefined;
        spo2?: number | null | undefined;
        hr?: number | null | undefined;
        hgt?: string | null | undefined;
        transportId?: number | null | undefined;
        hospitalId?: number | null | undefined;
    }, {
        patientNumber: number;
        drugs?: {
            drugId: number;
            dosageValue?: number | null | undefined;
            dosageUom?: string | null | undefined;
            timeAdministered?: string | null | undefined;
        }[] | undefined;
        name?: string | null | undefined;
        age?: number | null | undefined;
        gender?: "Male" | "Female" | null | undefined;
        reasonId?: number | null | undefined;
        colourCode?: "Green" | "Yellow" | "Orange" | "Red" | "Blue" | null | undefined;
        medicalHistory?: string | null | undefined;
        bpSystolic?: number | null | undefined;
        bpDiastolic?: number | null | undefined;
        gcs?: number | null | undefined;
        spo2?: number | null | undefined;
        hr?: number | null | undefined;
        hgt?: string | null | undefined;
        transportId?: number | null | undefined;
        hospitalId?: number | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    patientCount: number;
    responderIds: number[];
    primaryResponderId: number;
    localId?: string | undefined;
    callTypeId?: number | null | undefined;
    locationId?: number | null | undefined;
    patients?: {
        patientNumber: number;
        drugs?: {
            drugId: number;
            dosageValue?: number | null | undefined;
            dosageUom?: string | null | undefined;
            timeAdministered?: string | null | undefined;
        }[] | undefined;
        name?: string | null | undefined;
        age?: number | null | undefined;
        gender?: "Male" | "Female" | null | undefined;
        reasonId?: number | null | undefined;
        colourCode?: "Green" | "Yellow" | "Orange" | "Red" | "Blue" | null | undefined;
        medicalHistory?: string | null | undefined;
        bpSystolic?: number | null | undefined;
        bpDiastolic?: number | null | undefined;
        gcs?: number | null | undefined;
        spo2?: number | null | undefined;
        hr?: number | null | undefined;
        hgt?: string | null | undefined;
        transportId?: number | null | undefined;
        hospitalId?: number | null | undefined;
    }[] | undefined;
}, {
    responderIds: number[];
    primaryResponderId: number;
    localId?: string | undefined;
    callTypeId?: number | null | undefined;
    locationId?: number | null | undefined;
    patientCount?: number | undefined;
    patients?: {
        patientNumber: number;
        drugs?: {
            drugId: number;
            dosageValue?: number | null | undefined;
            dosageUom?: string | null | undefined;
            timeAdministered?: string | null | undefined;
        }[] | undefined;
        name?: string | null | undefined;
        age?: number | null | undefined;
        gender?: "Male" | "Female" | null | undefined;
        reasonId?: number | null | undefined;
        colourCode?: "Green" | "Yellow" | "Orange" | "Red" | "Blue" | null | undefined;
        medicalHistory?: string | null | undefined;
        bpSystolic?: number | null | undefined;
        bpDiastolic?: number | null | undefined;
        gcs?: number | null | undefined;
        spo2?: number | null | undefined;
        hr?: number | null | undefined;
        hgt?: string | null | undefined;
        transportId?: number | null | undefined;
        hospitalId?: number | null | undefined;
    }[] | undefined;
}>;
export declare const LovCreateSchema: z.ZodObject<{
    value: z.ZodString;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    createdBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string;
    sortOrder?: number | undefined;
    createdBy?: string | undefined;
}, {
    value: string;
    sortOrder?: number | undefined;
    createdBy?: string | undefined;
}>;
export declare const LovUpdateSchema: z.ZodObject<{
    value: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    value?: string | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
}, {
    value?: string | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
}>;
export declare const LovDrugCreateSchema: z.ZodObject<{
    name: z.ZodString;
    defaultUom: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    createdBy?: string | undefined;
    defaultUom?: string | null | undefined;
}, {
    name: string;
    createdBy?: string | undefined;
    defaultUom?: string | null | undefined;
}>;
export declare const LovLocationCreateSchema: z.ZodObject<{
    value: z.ZodString;
    areaId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    createdBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string;
    createdBy?: string | undefined;
    areaId?: number | null | undefined;
}, {
    value: string;
    createdBy?: string | undefined;
    areaId?: number | null | undefined;
}>;
