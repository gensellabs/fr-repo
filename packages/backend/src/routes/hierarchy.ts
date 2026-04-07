import { prisma } from '../lib/prisma';
import { generateUsername } from '../lib/username';
/**
 * /api/hierarchy — Geographic & organisational hierarchy management
 *
 * Public  GET  /api/hierarchy/countries
 * Public  GET  /api/hierarchy/provinces?countryId=
 * Public  GET  /api/hierarchy/districts?provinceId=
 * Public  GET  /api/hierarchy/organisations?districtId=
 *
 * SuperAdmin  POST/PUT/DELETE  countries, provinces, districts
 * SuperAdmin  POST/PUT         admin-users
 * CountrySysAdmin+  POST/PUT   organisations, org-registrations (approve/reject)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';

import bcrypt from 'bcryptjs';
import {
  requireAuth,
  requireSuperAdmin,
  requireCountrySysAdmin,
} from '../middleware/auth';

const router = Router();


// ══════════════════════════════════════════════════════════════════════════════
// COUNTRIES
// ══════════════════════════════════════════════════════════════════════════════

router.get('/countries', async (_req, res) => {
  const rows = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { organisations: true } } },
  });
  res.json(rows);
});

router.get('/countries/all', requireAuth, requireSuperAdmin, async (_req, res) => {
  const rows = await prisma.country.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { organisations: true } } },
  });
  res.json(rows);
});

router.post('/countries', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { name, isoCode } = req.body as { name: string; isoCode: string };
  if (!name || !isoCode) { res.status(400).json({ error: 'name and isoCode required' }); return; }
  const row = await prisma.country.create({ data: { name, isoCode: isoCode.toUpperCase() } });
  res.status(201).json(row);
});

router.put('/countries/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { name, isoCode, isActive } = req.body;
  const row = await prisma.country.update({
    where: { id: parseInt(req.params.id, 10) },
    data: { name, isoCode: isoCode?.toUpperCase(), isActive },
  });
  res.json(row);
});

// ══════════════════════════════════════════════════════════════════════════════
// PROVINCES
// ══════════════════════════════════════════════════════════════════════════════

router.get('/provinces', async (req, res) => {
  const countryId = req.query.countryId ? parseInt(req.query.countryId as string, 10) : undefined;
  const rows = await prisma.province.findMany({
    where: { isActive: true, ...(countryId ? { countryId } : {}) },
    orderBy: [{ country: { name: 'asc' } }, { name: 'asc' }],
    include: { country: { select: { name: true } } },
  });
  res.json(rows);
});

router.post('/provinces', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { name, countryId } = req.body as { name: string; countryId: number };
  if (!name || !countryId) { res.status(400).json({ error: 'name and countryId required' }); return; }
  const row = await prisma.province.create({ data: { name, countryId } });
  res.status(201).json(row);
});

router.put('/provinces/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { name, isActive } = req.body;
  const row = await prisma.province.update({
    where: { id: parseInt(req.params.id, 10) },
    data: { name, isActive },
  });
  res.json(row);
});

// ══════════════════════════════════════════════════════════════════════════════
// DISTRICTS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/districts', async (req, res) => {
  const provinceId = req.query.provinceId ? parseInt(req.query.provinceId as string, 10) : undefined;
  const countryId  = req.query.countryId  ? parseInt(req.query.countryId  as string, 10) : undefined;
  const rows = await prisma.district.findMany({
    where: {
      isActive: true,
      ...(provinceId ? { provinceId } : {}),
      ...(countryId  ? { province: { countryId } } : {}),
    },
    orderBy: [{ province: { name: 'asc' } }, { name: 'asc' }],
    include: { province: { select: { name: true, country: { select: { name: true } } } } },
  });
  res.json(rows);
});

router.post('/districts', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { name, provinceId } = req.body as { name: string; provinceId: number };
  if (!name || !provinceId) { res.status(400).json({ error: 'name and provinceId required' }); return; }
  const row = await prisma.district.create({ data: { name, provinceId } });
  res.status(201).json(row);
});

router.put('/districts/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { name, isActive } = req.body;
  const row = await prisma.district.update({
    where: { id: parseInt(req.params.id, 10) },
    data: { name, isActive },
  });
  res.json(row);
});

// ══════════════════════════════════════════════════════════════════════════════
// ORGANISATIONS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/organisations', async (req, res) => {
  const districtId  = req.query.districtId  ? parseInt(req.query.districtId  as string, 10) : undefined;
  const provinceId  = req.query.provinceId  ? parseInt(req.query.provinceId  as string, 10) : undefined;
  const countryId   = req.query.countryId   ? parseInt(req.query.countryId   as string, 10) : undefined;
  const rows = await prisma.organisation.findMany({
    where: {
      isActive: true,
      ...(districtId ? { districtId }                               : {}),
      ...(provinceId ? { province: { id: provinceId } }             : {}),
      ...(countryId  ? { countryId }                                : {}),
    },
    orderBy: { name: 'asc' },
    include: {
      country:  { select: { name: true } },
      province: { select: { name: true } },
      district: { select: { name: true } },
      _count:   { select: { responders: true, incidents: true } },
    },
  });
  res.json(rows);
});

router.get('/organisations/all', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const countryId = req.auth?.role === 'SUPER_ADMIN' ? undefined : req.auth?.countryId;
  const rows = await prisma.organisation.findMany({
    where: countryId ? { countryId } : {},
    orderBy: { name: 'asc' },
    include: {
      country:  { select: { name: true } },
      province: { select: { name: true } },
      district: { select: { name: true } },
      _count:   { select: { responders: true, incidents: true } },
    },
  });
  res.json(rows);
});

router.post('/organisations', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const { name, countryId, provinceId, districtId } = req.body as {
    name: string; countryId: number; provinceId: number; districtId: number;
  };
  if (!name || !countryId || !provinceId || !districtId) {
    res.status(400).json({ error: 'name, countryId, provinceId, districtId required' });
    return;
  }
  if (name.length > 40) {
    res.status(400).json({ error: 'Organisation name must be 40 characters or fewer' });
    return;
  }
  const row = await prisma.organisation.create({
    data: { name, countryId, provinceId, districtId, approvedAt: new Date(), approvedById: req.auth?.adminUserId },
    include: { country: { select: { name: true } }, province: { select: { name: true } }, district: { select: { name: true } } },
  });
  res.status(201).json(row);
});

router.put('/organisations/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const { name, isActive, districtId, provinceId, countryId } = req.body;
  if (name && name.length > 40) {
    res.status(400).json({ error: 'Organisation name must be 40 characters or fewer' });
    return;
  }
  const row = await prisma.organisation.update({
    where: { id: parseInt(req.params.id, 10) },
    data: { name, isActive, districtId, provinceId, countryId },
    include: { country: { select: { name: true } }, province: { select: { name: true } }, district: { select: { name: true } } },
  });
  res.json(row);
});

router.delete('/organisations/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const responderCount = await prisma.lovResponder.count({ where: { organisationId: id } });
  if (responderCount > 0) {
    res.status(409).json({ error: `Cannot delete — this organisation has ${responderCount} responder(s). Please move or delete them first.` });
    return;
  }
  const incidentCount = await prisma.incident.count({ where: { organisationId: id } });
  if (incidentCount > 0) {
    res.status(409).json({ error: `Cannot delete — this organisation has ${incidentCount} incident record(s). Deactivate it instead of deleting.` });
    return;
  }
  try {
    await prisma.organisation.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(409).json({ error: 'Cannot delete — organisation may still have linked data.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN USERS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/admin-users', requireAuth, requireSuperAdmin, async (_req, res) => {
  const rows = await prisma.adminUser.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, email: true, mobile: true,
      role: true, countryId: true, isActive: true,
      createdAt: true, lastLoginAt: true,
      country: { select: { name: true } },
    },
  });
  res.json(rows);
});

router.post('/admin-users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { name, email, mobile, password, role, countryId } = req.body as {
    name: string; email: string; mobile?: string;
    password: string; role: string; countryId?: number;
  };
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'name, email, password and role are required' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const row = await prisma.adminUser.create({
    data: { name, email: email.toLowerCase(), mobile, passwordHash, role: role as any, countryId },
  });
  const { passwordHash: _, ...safe } = row;
  res.status(201).json(safe);
});

router.put('/admin-users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  const { name, email, mobile, password, role, countryId, isActive } = req.body;
  const data: Record<string, unknown> = { name, email, mobile, role, countryId, isActive };
  if (password) data.passwordHash = await bcrypt.hash(password, 12);
  const row = await prisma.adminUser.update({
    where: { id: parseInt(req.params.id, 10) },
    data,
  });
  const { passwordHash: _, ...safe } = row;
  res.json(safe);
});

// ══════════════════════════════════════════════════════════════════════════════
// ORG REGISTRATIONS (self-service)
// ══════════════════════════════════════════════════════════════════════════════

// Public — anyone can submit a registration request
router.post('/org-registrations', async (req: Request, res: Response) => {
  const { orgName, contactName, contactEmail, contactMobile, countryId, provinceId, districtId } = req.body as {
    orgName: string; contactName: string; contactEmail: string;
    contactMobile?: string; countryId: number; provinceId: number; districtId: number;
  };
  if (!orgName || !contactName || !contactEmail || !countryId || !provinceId || !districtId) {
    res.status(400).json({ error: 'All fields except contactMobile are required' });
    return;
  }
  if (orgName.length > 40) {
    res.status(400).json({ error: 'Organisation name must be 40 characters or fewer' });
    return;
  }
  const row = await prisma.orgRegistration.create({
    data: { orgName, contactName, contactEmail, contactMobile, countryId, provinceId, districtId },
  });
  res.status(201).json(row);
});

// CountrySysAdmin+ — list pending registrations
router.get('/org-registrations', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const countryId = req.auth?.role === 'SUPER_ADMIN' ? undefined : req.auth?.countryId;
  const rows = await prisma.orgRegistration.findMany({
    where: countryId ? { countryId } : {},
    orderBy: { submittedAt: 'desc' },
  });
  res.json(rows);
});

// CountrySysAdmin+ — approve or reject
router.put('/org-registrations/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const { status, reviewNotes } = req.body as { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string };
  const regId = parseInt(req.params.id, 10);

  const reg = await prisma.orgRegistration.update({
    where: { id: regId },
    data: { status, reviewNotes, reviewedAt: new Date(), reviewedById: req.auth?.adminUserId },
  });

  // On approval, automatically create the organisation + initial GROUP_SYSADMIN
  if (status === 'APPROVED') {
    const org = await prisma.organisation.create({
      data: {
        name: reg.orgName,
        countryId: reg.countryId,
        provinceId: reg.provinceId,
        districtId: reg.districtId,
        approvedAt: new Date(),
        approvedById: req.auth?.adminUserId,
      },
    });

    const tempPassword = crypto.randomBytes(10).toString('hex'); // 20-char hex
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    // Split contactName into firstName + surname on the first space
    const nameParts  = reg.contactName.trim().split(/\s+/);
    const firstName  = nameParts[0] ?? reg.contactName;
    const surname    = nameParts.slice(1).join(' ') || null;

    // Look up country ISO code for username generation
    const countryRow = await prisma.country.findUnique({ where: { id: reg.countryId }, select: { isoCode: true } });
    const username   = countryRow
      ? await generateUsername(firstName, surname, countryRow.isoCode, reg.contactMobile ?? null)
      : null;

    const groupSysAdmin = await prisma.lovResponder.create({
      data: {
        value: reg.contactName,
        firstName,
        surname,
        username,
        email: reg.contactEmail,
        mobile: reg.contactMobile ?? null,
        organisationId: org.id,
        role: 'GROUP_SYSADMIN',
        isAdmin: true,
        isSysAdmin: true,
        passwordHash,
      },
      select: { id: true, value: true, firstName: true, surname: true, email: true, username: true },
    });

    res.json({ registration: reg, organisation: org, groupSysAdmin, tempPassword });
    return;
  }

  res.json({ registration: reg });
});

export default router;
