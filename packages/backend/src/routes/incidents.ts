import { prisma } from '../lib/prisma';
import { Router, Request, Response } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';

import { requireAuth } from '../middleware/auth';
import { IncidentCreateSchema, PatientSchema, PatientDrugSchema } from '@firstresponders/shared';
import { createObjectCsvStringifier } from 'csv-writer';
import { photoUpload } from '../middleware/upload';
import { r2, R2_BUCKET } from '../lib/r2';

const router = Router();


const incidentInclude = {
  callType: true,
  location: { include: { area: true } },
  organisation: {
    include: {
      district: {
        include: { province: { include: { country: true } } },
      },
    },
  },
  responders: { include: { responder: true } },
  photos: true,
  patients: {
    orderBy: { patientNumber: 'asc' as const },
    include: {
      reason: true,
      transport: true,
      hospital: true,
      drugs: { include: { drug: true } },
      photos: true,
    },
  },
};

// ─── GET /api/incidents ───────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const {
    date, fromDate, toDate,
    callTypeId, responderId, areaId, colourCode,
    organisationId, districtId, provinceId, countryId,
    limit = '50', offset = '0',
  } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};

  // Date filters
  if (date) {
    const day = new Date(date);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    where.incidentDate = { gte: day, lt: nextDay };
  } else if (fromDate || toDate) {
    const dateFilter: Record<string, Date> = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) {
      const to = new Date(toDate);
      to.setDate(to.getDate() + 1);
      dateFilter.lt = to;
    }
    where.incidentDate = dateFilter;
  }

  // Multi-value filters (comma-separated)
  if (callTypeId) {
    const ids = callTypeId.split(',').map((id) => parseInt(id.trim(), 10)).filter(Boolean);
    where.callTypeId = ids.length === 1 ? ids[0] : { in: ids };
  }
  if (responderId) {
    const ids = responderId.split(',').map((id) => parseInt(id.trim(), 10)).filter(Boolean);
    where.responders = { some: { responderId: ids.length === 1 ? ids[0] : { in: ids } } };
  }
  if (areaId) {
    const ids = areaId.split(',').map((id) => parseInt(id.trim(), 10)).filter(Boolean);
    where.location = { areaId: ids.length === 1 ? ids[0] : { in: ids } };
  }
  if (colourCode) {
    const codes = colourCode.split(',').map((c) => c.trim()).filter(Boolean);
    where.patients = { some: { colourCode: codes.length === 1 ? codes[0] : { in: codes } } };
  }

  // ── Hierarchy / tenancy scoping ─────────────────────────────────────────────
  const orgFilter: Record<string, unknown> = {};
  const role = req.auth?.role as string | undefined;
  const isGroupRole = role === 'GROUP_SYSADMIN' || role === 'GROUP_ADMIN' || role === 'RESPONDER';

  if (isGroupRole) {
    // GROUP roles: hard-restrict to their own organisation — non-overridable
    if (req.auth?.organisationId) orgFilter.id = req.auth.organisationId;
  } else {
    // COUNTRY_SYSADMIN is always restricted to their own country
    if (role === 'COUNTRY_SYSADMIN' && req.auth?.countryId) {
      orgFilter.countryId = req.auth.countryId;
    }
    // SuperAdmin can optionally filter by country
    if (countryId && role === 'SUPER_ADMIN') {
      const cIds = countryId.split(',').map(Number).filter(Boolean);
      if (cIds.length) orgFilter.countryId = cIds.length === 1 ? cIds[0] : { in: cIds };
    }
    if (provinceId) {
      const pIds = provinceId.split(',').map(Number).filter(Boolean);
      if (pIds.length) orgFilter.provinceId = pIds.length === 1 ? pIds[0] : { in: pIds };
    }
    if (districtId) {
      const dIds = districtId.split(',').map(Number).filter(Boolean);
      if (dIds.length) orgFilter.districtId = dIds.length === 1 ? dIds[0] : { in: dIds };
    }
    if (organisationId) {
      const oIds = organisationId.split(',').map(Number).filter(Boolean);
      if (oIds.length) orgFilter.id = oIds.length === 1 ? oIds[0] : { in: oIds };
    }
  }

  if (Object.keys(orgFilter).length > 0) {
    where.organisation = orgFilter;
  }

  const [total, items] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      include: incidentInclude,
      orderBy: { incidentDate: 'desc' },
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
    }),
  ]);

  res.json({ total, items });
});

// ─── GET /api/incidents/export/csv ───────────────────────────────────────────
router.get('/export/csv', requireAuth, async (req: Request, res: Response) => {
  const { fromDate, toDate, callTypeId, responderId, areaId, organisationId, districtId, provinceId, countryId } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (fromDate || toDate) {
    const dateFilter: Record<string, Date> = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) { const to = new Date(toDate); to.setDate(to.getDate() + 1); dateFilter.lt = to; }
    where.incidentDate = dateFilter;
  }
  if (callTypeId) {
    const ids = callTypeId.split(',').map((id) => parseInt(id, 10)).filter(Boolean);
    where.callTypeId = { in: ids };
  }
  if (responderId) {
    const ids = responderId.split(',').map((id) => parseInt(id, 10)).filter(Boolean);
    where.responders = { some: { responderId: { in: ids } } };
  }
  if (areaId) {
    const ids = areaId.split(',').map((id) => parseInt(id, 10)).filter(Boolean);
    where.location = { areaId: { in: ids } };
  }
  // Hierarchy scoping (mirrors GET /)
  const csvOrgFilter: Record<string, unknown> = {};
  const csvRole = req.auth?.role as string | undefined;
  const csvIsGroupRole = csvRole === 'GROUP_SYSADMIN' || csvRole === 'GROUP_ADMIN' || csvRole === 'RESPONDER';
  if (csvIsGroupRole) {
    if (req.auth?.organisationId) csvOrgFilter.id = req.auth.organisationId;
  } else {
    if (csvRole === 'COUNTRY_SYSADMIN' && req.auth?.countryId) {
      csvOrgFilter.countryId = req.auth.countryId;
    }
    if (countryId && csvRole === 'SUPER_ADMIN') {
      const cIds = countryId.split(',').map(Number).filter(Boolean);
      if (cIds.length) csvOrgFilter.countryId = cIds.length === 1 ? cIds[0] : { in: cIds };
    }
    if (provinceId) { const pIds = provinceId.split(',').map(Number).filter(Boolean); if (pIds.length) csvOrgFilter.provinceId = pIds.length === 1 ? pIds[0] : { in: pIds }; }
    if (districtId) { const dIds = districtId.split(',').map(Number).filter(Boolean); if (dIds.length) csvOrgFilter.districtId = dIds.length === 1 ? dIds[0] : { in: dIds }; }
    if (organisationId) { const oIds = organisationId.split(',').map(Number).filter(Boolean); if (oIds.length) csvOrgFilter.id = oIds.length === 1 ? oIds[0] : { in: oIds }; }
  }
  if (Object.keys(csvOrgFilter).length > 0) where.organisation = csvOrgFilter;

  const incidents = await prisma.incident.findMany({
    where,
    include: incidentInclude,
    orderBy: { incidentDate: 'desc' },
  });

  const rows: Record<string, string>[] = [];
  for (const inc of incidents) {
    for (const patient of inc.patients) {
      const incOrg = (inc as unknown as { organisation?: { name: string; district?: { name: string; province?: { name: string; country?: { name: string } } } } }).organisation;
      rows.push({
        Date: inc.incidentDate.toISOString().split('T')[0],
        Time: inc.incidentDate.toISOString().split('T')[1].substring(0, 8),
        Country: incOrg?.district?.province?.country?.name ?? '',
        Province: incOrg?.district?.province?.name ?? '',
        District: incOrg?.district?.name ?? '',
        Organisation: incOrg?.name ?? '',
        CallType: inc.callType?.value ?? '',
        Diagnosis: (patient as { reason?: { value: string } }).reason?.value ?? '',
        Area: inc.location?.area?.value ?? '',
        Location: inc.location?.value ?? '',
        PatientNo: String(patient.patientNumber),
        ColourCode: patient.colourCode ?? '',
        BP: patient.bpSystolic ? `${patient.bpSystolic}/${patient.bpDiastolic}` : '',
        GCS: patient.gcs != null ? String(patient.gcs) : '',
        SpO2: patient.spo2 != null ? String(patient.spo2) : '',
        HR: patient.hr != null ? String(patient.hr) : '',
        HGT: patient.hgt ?? '',
        MedicalHistory: patient.medicalHistory ?? '',
        Drugs: patient.drugs
          .map((d) => `${d.drug.name} ${d.dosageValue ?? ''}${d.dosageUom ?? ''} @ ${d.timeAdministered ?? ''}`)
          .join(' | '),
        Transport: patient.transport?.value ?? '',
        Hospital: patient.hospital?.value ?? '',
        Responders: inc.responders.map((r) => r.responder.value).join(', '),
      });
    }
  }

  if (rows.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="incidents.csv"');
    res.send('No data found for the selected filters.\n');
    return;
  }

  const csv = createObjectCsvStringifier({
    header: Object.keys(rows[0]).map((id) => ({ id, title: id })),
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="incidents.csv"');
  res.send(csv.getHeaderString() + csv.stringifyRecords(rows));
});

// ─── GET /api/incidents/:id ───────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const incident = await prisma.incident.findUnique({
    where: { id: parseInt(req.params.id, 10) },
    include: incidentInclude,
  });
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  // GROUP roles can only access their own org's incidents
  const role = req.auth?.role as string | undefined;
  const isGroupRole = role === 'GROUP_SYSADMIN' || role === 'GROUP_ADMIN' || role === 'RESPONDER';
  if (isGroupRole && incident.organisationId !== req.auth?.organisationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  res.json(incident);
});

// ─── POST /api/incidents ──────────────────────────────────────────────────────
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const data = IncidentCreateSchema.parse(req.body);

  // Handle offline dedup: if localId exists and already synced, return existing
  if (data.localId) {
    const existing = await prisma.incident.findUnique({ where: { localId: data.localId }, include: incidentInclude });
    if (existing) {
      res.status(200).json(existing);
      return;
    }
  }

  const incident = await prisma.incident.create({
    data: {
      localId: data.localId,
      organisationId: req.auth?.organisationId ?? null,
      callTypeId: data.callTypeId ?? null,
      locationId: data.locationId ?? null,
      patientCount: data.patientCount,
      syncedAt: new Date(),
      responders: {
        create: (data.responderIds ?? []).map((rid) => ({
          responderId: rid,
          isPrimary: rid === data.primaryResponderId,
        })),
      },
      patients: {
        create: (data.patients ?? []).map((p) => ({
          patientNumber: p.patientNumber,
          name: p.name ?? null,
          age: p.age ?? null,
          gender: p.gender ?? null,
          reasonId: p.reasonId ?? null,
          colourCode: p.colourCode ?? null,
          medicalHistory: p.medicalHistory ?? null,
          bpSystolic: p.bpSystolic ?? null,
          bpDiastolic: p.bpDiastolic ?? null,
          gcs: p.gcs ?? null,
          spo2: p.spo2 ?? null,
          hr: p.hr ?? null,
          hgt: p.hgt ?? null,
          transportId: p.transportId ?? null,
          hospitalId: p.hospitalId ?? null,
          drugs: {
            create: (p.drugs ?? []).map((d) => ({
              drugId: d.drugId,
              dosageValue: d.dosageValue ?? null,
              dosageUom: d.dosageUom ?? null,
              timeAdministered: d.timeAdministered ? new Date(`1970-01-01T${d.timeAdministered}:00`) : null,
            })),
          },
        })),
      },
    },
    include: incidentInclude,
  });

  res.status(201).json(incident);
});

// ─── PUT /api/incidents/:id  (last-write-wins) ────────────────────────────────
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const data = IncidentCreateSchema.partial().parse(req.body);

  const existing = await prisma.incident.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  // GROUP roles can only update their own org's incidents
  const putRole = req.auth?.role as string | undefined;
  const putIsGroupRole = putRole === 'GROUP_SYSADMIN' || putRole === 'GROUP_ADMIN' || putRole === 'RESPONDER';
  if (putIsGroupRole && existing.organisationId !== req.auth?.organisationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Last-write-wins: client sends updatedAt; if server is newer, reject
  const clientUpdatedAt = req.body.updatedAt ? new Date(req.body.updatedAt as string) : null;
  if (clientUpdatedAt && existing.updatedAt > clientUpdatedAt) {
    res.status(409).json({
      error: 'Conflict: server has newer data',
      serverUpdatedAt: existing.updatedAt,
    });
    return;
  }

  // Delete and recreate patients for simplicity (cascade deletes drugs)
  await prisma.patient.deleteMany({ where: { incidentId: id } });
  await prisma.incidentResponder.deleteMany({ where: { incidentId: id } });

  const incident = await prisma.incident.update({
    where: { id },
    data: {
      callTypeId: data.callTypeId ?? null,
      locationId: data.locationId ?? null,
      patientCount: data.patientCount,
      syncedAt: new Date(),
      responders: {
        create: (data.responderIds ?? []).map((rid) => ({
          responderId: rid,
          isPrimary: rid === data.primaryResponderId,
        })),
      },
      patients: {
        create: (data.patients ?? []).map((p) => ({
          patientNumber: p.patientNumber,
          name: p.name ?? null,
          age: p.age ?? null,
          gender: p.gender ?? null,
          reasonId: p.reasonId ?? null,
          colourCode: p.colourCode ?? null,
          medicalHistory: p.medicalHistory ?? null,
          bpSystolic: p.bpSystolic ?? null,
          bpDiastolic: p.bpDiastolic ?? null,
          gcs: p.gcs ?? null,
          spo2: p.spo2 ?? null,
          hr: p.hr ?? null,
          hgt: p.hgt ?? null,
          transportId: p.transportId ?? null,
          hospitalId: p.hospitalId ?? null,
          drugs: {
            create: (p.drugs ?? []).map((d) => ({
              drugId: d.drugId,
              dosageValue: d.dosageValue ?? null,
              dosageUom: d.dosageUom ?? null,
              timeAdministered: d.timeAdministered ? new Date(`1970-01-01T${d.timeAdministered}:00`) : null,
            })),
          },
        })),
      },
    },
    include: incidentInclude,
  });

  res.json(incident);
});

// ─── POST /api/incidents/:id/photos ──────────────────────────────────────────
router.post(
  '/:id/photos',
  requireAuth,
  photoUpload.single('photo'),
  async (req: Request, res: Response) => {
    const incidentId = parseInt(req.params.id, 10);
    if (!req.file) {
      res.status(400).json({ error: 'No photo file provided' });
      return;
    }
    const { latitude, longitude, altitude, patientId, capturedAt } = req.body as {
      latitude?: string; longitude?: string; altitude?: string;
      patientId?: string; capturedAt?: string;
    };

    // Upload to Cloudflare R2
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const key = `photos/${uuidv4()}${ext}`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const photo = await prisma.incidentPhoto.create({
      data: {
        incidentId,
        patientId: patientId ? parseInt(patientId, 10) : null,
        storagePath: key,
        latitude:  latitude  ? parseFloat(latitude)  : null,
        longitude: longitude ? parseFloat(longitude) : null,
        altitude:  altitude  ? parseFloat(altitude)  : null,
        capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
        capturedBy: req.auth!.responderId ?? 0,
      },
      include: { responder: true },
    });
    res.status(201).json(photo);
  },
);

// ─── POST /api/incidents/:id/patients ────────────────────────────────────────
router.post('/:id/patients', requireAuth, async (req: Request, res: Response) => {
  const incidentId = parseInt(req.params.id, 10);
  const data = PatientSchema.parse(req.body);

  const patient = await prisma.patient.create({
    data: {
      incidentId,
      patientNumber: data.patientNumber,
      colourCode: data.colourCode ?? null,
      medicalHistory: data.medicalHistory ?? null,
      bpSystolic: data.bpSystolic ?? null,
      bpDiastolic: data.bpDiastolic ?? null,
      gcs: data.gcs ?? null,
      spo2: data.spo2 ?? null,
      hr: data.hr ?? null,
      hgt: data.hgt ?? null,
      transportId: data.transportId ?? null,
      hospitalId: data.hospitalId ?? null,
    },
    include: { transport: true, hospital: true, drugs: { include: { drug: true } } },
  });

  res.status(201).json(patient);
});

// ─── PUT /api/patients/:id ────────────────────────────────────────────────────
router.put('/patients/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const data = PatientSchema.partial().parse(req.body);

  const patient = await prisma.patient.update({
    where: { id },
    data: {
      colourCode: data.colourCode,
      medicalHistory: data.medicalHistory,
      bpSystolic: data.bpSystolic,
      bpDiastolic: data.bpDiastolic,
      gcs: data.gcs,
      spo2: data.spo2,
      hr: data.hr,
      hgt: data.hgt,
      transportId: data.transportId,
      hospitalId: data.hospitalId,
    },
    include: { transport: true, hospital: true, drugs: { include: { drug: true } } },
  });
  res.json(patient);
});

// ─── POST /api/patients/:id/drugs ────────────────────────────────────────────
router.post('/patients/:id/drugs', requireAuth, async (req: Request, res: Response) => {
  const patientId = parseInt(req.params.id, 10);
  const data = PatientDrugSchema.parse(req.body);

  const drug = await prisma.patientDrug.create({
    data: {
      patientId,
      drugId: data.drugId,
      dosageValue: data.dosageValue ?? null,
      dosageUom: data.dosageUom ?? null,
      timeAdministered: data.timeAdministered ? new Date(`1970-01-01T${data.timeAdministered}:00`) : null,
    },
    include: { drug: true },
  });
  res.status(201).json(drug);
});

// ─── DELETE /api/patients/:patientId/drugs/:drugId ────────────────────────────
router.delete('/patients/:patientId/drugs/:id', requireAuth, async (req: Request, res: Response) => {
  await prisma.patientDrug.delete({ where: { id: parseInt(req.params.id, 10) } });
  res.status(204).send();
});

export default router;
