-- CreateTable
CREATE TABLE "lov_call_types" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lov_call_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lov_reasons" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lov_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lov_areas" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lov_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lov_locations" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "areaId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lov_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lov_transports" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lov_transports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lov_hospitals" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lov_hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lov_responders" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lov_responders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lov_medical_history_presets" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lov_medical_history_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lov_drugs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "defaultUom" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "lov_drugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" SERIAL NOT NULL,
    "localId" TEXT,
    "incidentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "callTypeId" INTEGER,
    "reasonId" INTEGER,
    "locationId" INTEGER,
    "patientCount" INTEGER NOT NULL DEFAULT 1,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" SERIAL NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "patientNumber" INTEGER NOT NULL,
    "colourCode" TEXT,
    "medicalHistory" TEXT,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "gcs" INTEGER,
    "spo2" INTEGER,
    "hr" INTEGER,
    "hgt" TEXT,
    "transportId" INTEGER,
    "hospitalId" INTEGER,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_drugs" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "drugId" INTEGER NOT NULL,
    "dosageValue" DECIMAL(8,3),
    "dosageUom" TEXT,
    "timeAdministered" TIMESTAMP(3),

    CONSTRAINT "patient_drugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_responders" (
    "id" SERIAL NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "responderId" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "incident_responders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_photos" (
    "id" SERIAL NOT NULL,
    "incidentId" INTEGER NOT NULL,
    "patientId" INTEGER,
    "storagePath" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "altitude" DECIMAL(8,2),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedBy" INTEGER NOT NULL,

    CONSTRAINT "incident_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lov_call_types_value_key" ON "lov_call_types"("value");

-- CreateIndex
CREATE UNIQUE INDEX "lov_reasons_value_key" ON "lov_reasons"("value");

-- CreateIndex
CREATE UNIQUE INDEX "lov_areas_value_key" ON "lov_areas"("value");

-- CreateIndex
CREATE UNIQUE INDEX "lov_locations_value_areaId_key" ON "lov_locations"("value", "areaId");

-- CreateIndex
CREATE UNIQUE INDEX "lov_transports_value_key" ON "lov_transports"("value");

-- CreateIndex
CREATE UNIQUE INDEX "lov_hospitals_value_key" ON "lov_hospitals"("value");

-- CreateIndex
CREATE UNIQUE INDEX "lov_responders_value_key" ON "lov_responders"("value");

-- CreateIndex
CREATE UNIQUE INDEX "lov_medical_history_presets_value_key" ON "lov_medical_history_presets"("value");

-- CreateIndex
CREATE UNIQUE INDEX "lov_drugs_name_key" ON "lov_drugs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_localId_key" ON "incidents"("localId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_incidentId_patientNumber_key" ON "patients"("incidentId", "patientNumber");

-- CreateIndex
CREATE UNIQUE INDEX "incident_responders_incidentId_responderId_key" ON "incident_responders"("incidentId", "responderId");

-- AddForeignKey
ALTER TABLE "lov_locations" ADD CONSTRAINT "lov_locations_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "lov_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_callTypeId_fkey" FOREIGN KEY ("callTypeId") REFERENCES "lov_call_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "lov_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "lov_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "lov_transports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "lov_hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_drugs" ADD CONSTRAINT "patient_drugs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_drugs" ADD CONSTRAINT "patient_drugs_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "lov_drugs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_responders" ADD CONSTRAINT "incident_responders_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_responders" ADD CONSTRAINT "incident_responders_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "lov_responders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_photos" ADD CONSTRAINT "incident_photos_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_photos" ADD CONSTRAINT "incident_photos_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_photos" ADD CONSTRAINT "incident_photos_capturedBy_fkey" FOREIGN KEY ("capturedBy") REFERENCES "lov_responders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
