import { prisma } from '../lib/prisma';
import { Router, Request, Response } from 'express';

import { requireAuth, requireAdmin, requireCountrySysAdmin, AuthPayload } from '../middleware/auth';
import { generateUsername } from '../lib/username';
import { LovCreateSchema, LovUpdateSchema, LovDrugCreateSchema, LovLocationCreateSchema } from '@firstresponders/shared';

const router = Router();


// Map URL segment → Prisma delegate + special handling flag
type TableKey =
  | 'call_types' | 'reasons' | 'areas' | 'locations'
  | 'transports' | 'hospitals' | 'responders'
  | 'medical_history_presets' | 'drugs';

function getDelegate(table: TableKey) {
  const map: Record<TableKey, unknown> = {
    call_types:              prisma.lovCallType,
    reasons:                 prisma.lovReason,
    areas:                   prisma.lovArea,
    locations:               prisma.lovLocation,
    transports:              prisma.lovTransport,
    hospitals:               prisma.lovHospital,
    responders:              prisma.lovResponder,
    medical_history_presets: prisma.lovMedicalHistoryPreset,
    drugs:                   prisma.lovDrug,
  };
  return map[table] as ReturnType<typeof prisma.$transaction> extends Promise<infer T> ? T : never;
}

const VALID_TABLES: TableKey[] = [
  'call_types', 'reasons', 'areas', 'locations', 'transports',
  'hospitals', 'responders', 'medical_history_presets', 'drugs',
];

function validateTable(table: string): table is TableKey {
  return VALID_TABLES.includes(table as TableKey);
}

async function writeAudit(
  tableName: string,
  recordId: number,
  action: string,
  oldValue: string | null,
  newValue: string | null,
  auth?: AuthPayload,
) {
  await prisma.auditLog.create({
    data: {
      tableName,
      recordId,
      action,
      oldValue,
      newValue,
      changedBy: auth?.responderName ?? 'system',
    },
  });
}

// ─── GET /api/lovs/areas  (special: includes nested locations, scoped to org) ──
router.get('/areas', requireAuth, async (req: Request, res: Response) => {
  const orgId = req.auth?.organisationId;
  const areas = await prisma.lovArea.findMany({
    where: { isActive: true, ...(orgId ? { organisationId: orgId } : {}) },
    orderBy: { sortOrder: 'asc' },
    include: {
      locations: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  res.json(areas);
});

// ─── GET /api/lovs/locations  (optionally filtered by area) ───────────────────
router.get('/locations', requireAuth, async (req: Request, res: Response) => {
  const areaId = req.query.areaId ? Number(req.query.areaId) : undefined;
  const includeInactive = req.query.includeInactive === 'true';
  const locations = await prisma.lovLocation.findMany({
    where: {
      ...(areaId !== undefined ? { areaId } : {}),
      ...(!includeInactive ? { isActive: true } : {}),
    },
    orderBy: { sortOrder: 'asc' },
    include: { area: true },
  });
  res.json(locations);
});

// ─── GET /api/lovs/:table ─────────────────────────────────────────────────────
router.get('/:table', requireAuth, async (req: Request, res: Response) => {
  const { table } = req.params;
  if (!validateTable(table)) {
    res.status(400).json({ error: `Unknown LOV table: ${table}` });
    return;
  }
  const includeInactive = req.query.includeInactive === 'true';

  if (table === 'drugs') {
    const items = await prisma.lovDrug.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(items);
    return;
  }

  if (table === 'responders') {
    const role    = req.auth?.role as string | undefined;
    const orgId   = req.auth?.organisationId;
    const isSuperAdmin    = role === 'SUPER_ADMIN';
    const isCountryAdmin  = role === 'COUNTRY_SYSADMIN';
    const canSeeAllOrgs   = isSuperAdmin || isCountryAdmin;
    const canSeeUsername  = isSuperAdmin || isCountryAdmin;

    // Filter params (only honoured for SUPER_ADMIN / COUNTRY_SYSADMIN)
    const filterCountryId  = canSeeAllOrgs && req.query.countryId  ? parseInt(req.query.countryId  as string, 10) : undefined;
    const filterProvinceId = canSeeAllOrgs && req.query.provinceId ? parseInt(req.query.provinceId as string, 10) : undefined;

    // Build where clause
    let where: Record<string, unknown> = {};
    if (!includeInactive) where.isActive = true;

    if (canSeeAllOrgs) {
      // COUNTRY_SYSADMIN is scoped to their country unless explicitly set as SuperAdmin
      if (isCountryAdmin && req.auth?.countryId) {
        where.organisation = { countryId: req.auth.countryId };
      }
      if (filterCountryId) {
        where.organisation = { ...(where.organisation as object ?? {}), countryId: filterCountryId };
      }
      if (filterProvinceId) {
        where.organisation = { ...(where.organisation as object ?? {}), provinceId: filterProvinceId };
      }
    } else {
      // GROUP_SYSADMIN / GROUP_ADMIN / RESPONDER: own org only
      if (orgId) where.organisationId = orgId;
    }

    const items = await prisma.lovResponder.findMany({
      where,
      select: {
        id: true, value: true, firstName: true, surname: true,
        ...(canSeeUsername ? { username: true } : {}),
        email: true, mobile: true,
        role: true, isAdmin: true, isSysAdmin: true,
        isActive: true, sortOrder: true, organisationId: true,
        organisation: canSeeAllOrgs
          ? {
              select: {
                id: true, name: true,
                country:  { select: { id: true, name: true, isoCode: true } },
                province: { select: { id: true, name: true } },
              },
            }
          : false,
      },
      orderBy: [{ organisation: { name: 'asc' } }, { sortOrder: 'asc' }],
    });
    res.json(items);
    return;
  }

  // Generic handler for simple LOVs
  const delegate = getDelegate(table) as {
    findMany: (args: object) => Promise<unknown[]>;
  };
  const items = await delegate.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(items);
});

// ─── POST /api/lovs/:table  (any authed user can add inline) ──────────────────
router.post('/:table', requireAuth, async (req: Request, res: Response) => {
  const { table } = req.params;
  if (!validateTable(table)) {
    res.status(400).json({ error: `Unknown LOV table: ${table}` });
    return;
  }

  if (table === 'drugs') {
    const data = LovDrugCreateSchema.parse(req.body);
    const item = await prisma.lovDrug.create({ data });
    await writeAudit('lov_drugs', item.id, 'CREATE', null, item.name, req.auth);
    res.status(201).json(item);
    return;
  }

  if (table === 'locations') {
    const data = LovLocationCreateSchema.parse(req.body);
    const item = await prisma.lovLocation.create({
      data: { value: data.value, areaId: data.areaId ?? null, createdBy: data.createdBy },
      include: { area: true },
    });
    await writeAudit('lov_locations', item.id, 'CREATE', null, item.value, req.auth);
    res.status(201).json(item);
    return;
  }

  if (table === 'responders') {
    const { firstName, surname, email, mobile, sortOrder, createdBy } = req.body as {
      firstName?: string; surname?: string; email?: string; mobile?: string;
      sortOrder?: number; createdBy?: string;
      value?: string; // legacy: still accepted
    };
    const first  = (firstName ?? req.body.value ?? '').trim();
    const last   = (surname ?? '').trim();
    const computed = [first, last].filter(Boolean).join(' ');
    if (!computed) {
      res.status(400).json({ error: 'First name is required' });
      return;
    }
    const mobileClean = mobile?.trim() || null;

    // E.164 validation if mobile provided
    if (mobileClean) {
      const e164Regex = /^\+[1-9]\d{7,14}$/;
      if (!e164Regex.test(mobileClean)) {
        res.status(400).json({ error: 'Mobile number must be in E.164 format (e.g. +27821234567)' });
        return;
      }
    }

    // Look up org → country for username generation
    const orgId = req.auth?.organisationId ?? null;
    let isoCode: string | null = null;
    if (orgId) {
      const org = await prisma.organisation.findUnique({
        where: { id: orgId },
        include: { country: { select: { isoCode: true } } },
      });
      isoCode = org?.country?.isoCode ?? null;
    }

    const username = isoCode
      ? await generateUsername(first, last, isoCode, mobileClean)
      : null;

    const item = await prisma.lovResponder.create({
      data: {
        value: computed,
        firstName: first || null,
        surname: last || null,
        username,
        email: email?.trim() || null,
        mobile: mobileClean,
        organisationId: orgId,
        sortOrder: sortOrder ?? 0,
        createdBy: createdBy ?? req.auth?.responderName ?? null,
      },
    });
    await writeAudit('lov_responders', item.id, 'CREATE', null, item.value, req.auth);
    res.status(201).json(item);
    return;
  }

  const data = LovCreateSchema.parse(req.body);
  const delegate = getDelegate(table) as {
    create: (args: { data: object }) => Promise<{ id: number; value: string }>;
  };
  const item = await delegate.create({
    data: { value: data.value, sortOrder: data.sortOrder ?? 0, createdBy: data.createdBy ?? req.auth?.responderName },
  });
  await writeAudit(`lov_${table}`, item.id, 'CREATE', null, item.value, req.auth);
  res.status(201).json(item);
});

// ─── PUT /api/lovs/:table/:id  (admin only) ───────────────────────────────────
router.put('/:table/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { table, id } = req.params;
  if (!validateTable(table)) {
    res.status(400).json({ error: `Unknown LOV table: ${table}` });
    return;
  }

  const recordId = parseInt(id, 10);

  // Special handling for locations — allow areaId update
  if (table === 'locations') {
    const { value, areaId, isActive } = req.body as { value?: string; areaId?: number | null; isActive?: boolean };
    const before = await prisma.lovLocation.findUnique({ where: { id: recordId } });
    const item = await prisma.lovLocation.update({
      where: { id: recordId },
      data: {
        ...(value !== undefined ? { value } : {}),
        ...(areaId !== undefined ? { areaId: areaId ?? null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    await writeAudit('lov_locations', recordId, 'UPDATE', before?.value ?? null, item.value, req.auth);
    res.json(item);
    return;
  }

  // Special handling for responders — allow firstName/surname/email/mobile update
  if (table === 'responders') {
    const { firstName, surname, email, mobile, isActive } = req.body as {
      firstName?: string; surname?: string; email?: string; mobile?: string; isActive?: boolean;
      value?: string; // legacy field still accepted
    };

    // E.164 validation + country dial-code check
    if (mobile !== undefined && mobile !== null && mobile !== '') {
      const e164Regex = /^\+[1-9]\d{7,14}$/;
      if (!e164Regex.test(mobile)) {
        res.status(400).json({ error: 'Mobile number must be in E.164 format (e.g. +27821234567)' });
        return;
      }
      const responderWithCountry = await prisma.lovResponder.findUnique({
        where: { id: recordId },
        include: { organisation: { include: { country: true } } },
      });
      const dialCode = responderWithCountry?.organisation?.country?.dialCode;
      if (dialCode && !mobile.startsWith(dialCode)) {
        res.status(400).json({ error: `Mobile number must start with ${dialCode} for this country` });
        return;
      }
    }

    // Compute display name if name fields are changing
    const before = await prisma.lovResponder.findUnique({ where: { id: recordId } });
    const newFirst   = firstName !== undefined ? firstName.trim() : before?.firstName ?? '';
    const newSurname = surname   !== undefined ? surname.trim()   : before?.surname   ?? '';
    const newValue   = [newFirst, newSurname].filter(Boolean).join(' ') || before?.value || '';

    const item = await prisma.lovResponder.update({
      where: { id: recordId },
      data: {
        value: newValue,
        ...(firstName !== undefined ? { firstName: firstName.trim() || null } : {}),
        ...(surname   !== undefined ? { surname:   surname.trim()   || null } : {}),
        ...(email     !== undefined ? { email:     email            || null } : {}),
        ...(mobile    !== undefined ? { mobile:    mobile           || null } : {}),
        ...(isActive  !== undefined ? { isActive }                           : {}),
      },
    });
    await writeAudit('lov_responders', recordId, 'UPDATE', before?.value ?? null, item.value, req.auth);
    res.json(item);
    return;
  }

  const data = LovUpdateSchema.parse(req.body);

  if (table === 'drugs') {
    const before = await prisma.lovDrug.findUnique({ where: { id: recordId } });
    const item = await prisma.lovDrug.update({ where: { id: recordId }, data });
    await writeAudit('lov_drugs', recordId, 'UPDATE', before?.name ?? null, item.name, req.auth);
    res.json(item);
    return;
  }

  const delegate = getDelegate(table) as {
    findUnique: (args: object) => Promise<{ value: string } | null>;
    update: (args: object) => Promise<{ id: number; value: string }>;
  };
  const before = await delegate.findUnique({ where: { id: recordId } });
  const item = await delegate.update({ where: { id: recordId }, data });
  await writeAudit(`lov_${table}`, recordId, 'UPDATE', before?.value ?? null, item.value, req.auth);
  res.json(item);
});

// ─── PATCH /api/lovs/:table/:id/deactivate  (admin only) ─────────────────────
router.patch('/:table/:id/deactivate', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { table, id } = req.params;
  if (!validateTable(table)) {
    res.status(400).json({ error: `Unknown LOV table: ${table}` });
    return;
  }
  const recordId = parseInt(id, 10);
  const delegate = getDelegate(table) as {
    update: (args: object) => Promise<{ id: number; value: string }>;
  };
  const item = await delegate.update({
    where: { id: recordId },
    data: { isActive: false },
  });
  await writeAudit(`lov_${table}`, recordId, 'DEACTIVATE', null, null, req.auth);
  res.json(item);
});

// ─── DELETE /api/lovs/:table/:id  (CountrySysAdmin+ only) ───────────────────
router.delete('/:table/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const { table, id } = req.params;
  if (!validateTable(table)) {
    res.status(400).json({ error: `Unknown LOV table: ${table}` });
    return;
  }
  const recordId = parseInt(id, 10);
  const delegate = getDelegate(table) as {
    findUnique: (args: object) => Promise<{ value?: string; name?: string } | null>;
    delete: (args: object) => Promise<unknown>;
  };
  try {
    // Area: must have no locations assigned before delete
    if (table === 'areas') {
      const locationCount = await prisma.lovLocation.count({ where: { areaId: recordId } });
      if (locationCount > 0) {
        res.status(409).json({ error: `Cannot delete — this area has ${locationCount} location(s) still assigned. Please move or delete them first.` });
        return;
      }
    }
    const before = await delegate.findUnique({ where: { id: recordId } });
    await delegate.delete({ where: { id: recordId } });
    await writeAudit(`lov_${table}`, recordId, 'DELETE', before?.value ?? before?.name ?? null, null, req.auth);
    res.status(204).send();
  } catch {
    res.status(409).json({ error: 'Cannot delete — this value may be in use by existing records.' });
  }
});

// ─── PATCH /api/lovs/:table/:id/reorder  (admin only) ────────────────────────
router.patch('/:table/:id/reorder', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { table, id } = req.params;
  if (!validateTable(table)) {
    res.status(400).json({ error: `Unknown LOV table: ${table}` });
    return;
  }
  const recordId = parseInt(id, 10);
  const { sortOrder } = req.body as { sortOrder: number };
  if (typeof sortOrder !== 'number') {
    res.status(400).json({ error: 'sortOrder must be a number' });
    return;
  }
  const delegate = getDelegate(table) as {
    update: (args: object) => Promise<unknown>;
  };
  const item = await delegate.update({ where: { id: recordId }, data: { sortOrder } });
  res.json(item);
});

export default router;
