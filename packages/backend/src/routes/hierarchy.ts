import { prisma } from '../lib/prisma';
import { generateUsername } from '../lib/username';
import { Resend } from 'resend';

// Lazy initialisation — avoids crash at module load if RESEND_API_KEY is not set
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}
/**
 * /api/hierarchy — Geographic & organisational hierarchy management
 *
 * Public  GET  /api/hierarchy/countries
 * Public  GET  /api/hierarchy/provinces?countryId=
 * Public  GET  /api/hierarchy/districts?provinceId=&countryId=
 * Public  GET  /api/hierarchy/areas?districtId=&countryId=
 * Public  GET  /api/hierarchy/organisations?districtId=
 *
 * SuperAdmin           POST/PUT  countries
 * CountrySysAdmin+     POST/PUT  provinces, districts, areas (scoped to own country)
 * CountrySysAdmin+     POST/PUT  organisations, org-registrations, group-admins
 * SuperAdmin           POST/PUT  admin-users
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';

import bcrypt from 'bcryptjs';
import {
  requireAuth,
  requireSuperAdmin,
  requireCountrySysAdmin,
  requireGroupSysAdmin,
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
// PROVINCES  (SuperAdmin: full; CountrySysAdmin: own country only)
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

router.post('/provinces', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const { name, countryId } = req.body as { name: string; countryId: number };
  if (!name || !countryId) { res.status(400).json({ error: 'name and countryId required' }); return; }
  // CountrySysAdmin may only create regions in their own country
  if (req.auth?.role === 'COUNTRY_SYSADMIN' && Number(countryId) !== req.auth.countryId) {
    res.status(403).json({ error: 'You can only create regions in your own country' }); return;
  }
  const row = await prisma.province.create({ data: { name, countryId: Number(countryId) } });
  res.status(201).json(row);
});

router.put('/provinces/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (req.auth?.role === 'COUNTRY_SYSADMIN') {
    const existing = await prisma.province.findUnique({ where: { id }, select: { countryId: true } });
    if (!existing || existing.countryId !== req.auth.countryId) {
      res.status(403).json({ error: 'Region is not in your country' }); return;
    }
  }
  const { name, isActive } = req.body;
  const row = await prisma.province.update({ where: { id }, data: { name, isActive } });
  res.json(row);
});

router.delete('/provinces/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (req.auth?.role === 'COUNTRY_SYSADMIN') {
    const existing = await prisma.province.findUnique({ where: { id }, select: { countryId: true } });
    if (!existing || existing.countryId !== req.auth.countryId) {
      res.status(403).json({ error: 'Region is not in your country' }); return;
    }
  }
  const childCount = await prisma.district.count({ where: { provinceId: id } });
  if (childCount > 0) {
    res.status(409).json({ error: `Cannot delete — this region has ${childCount} district(s). Delete them first.` }); return;
  }
  try {
    await prisma.province.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(409).json({ error: 'Cannot delete — region may still have linked data.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DISTRICTS  (SuperAdmin: full; CountrySysAdmin: own country only)
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

router.post('/districts', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const { name, provinceId } = req.body as { name: string; provinceId: number };
  if (!name || !provinceId) { res.status(400).json({ error: 'name and provinceId required' }); return; }
  // CountrySysAdmin: verify region belongs to their country
  if (req.auth?.role === 'COUNTRY_SYSADMIN') {
    const province = await prisma.province.findUnique({ where: { id: Number(provinceId) }, select: { countryId: true } });
    if (!province || province.countryId !== req.auth.countryId) {
      res.status(403).json({ error: 'Region is not in your country' }); return;
    }
  }
  const row = await prisma.district.create({ data: { name, provinceId: Number(provinceId) } });
  res.status(201).json(row);
});

router.put('/districts/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (req.auth?.role === 'COUNTRY_SYSADMIN') {
    const existing = await prisma.district.findUnique({ where: { id }, include: { province: { select: { countryId: true } } } });
    if (!existing || existing.province.countryId !== req.auth.countryId) {
      res.status(403).json({ error: 'District is not in your country' }); return;
    }
  }
  const { name, isActive } = req.body;
  const row = await prisma.district.update({ where: { id }, data: { name, isActive } });
  res.json(row);
});

router.delete('/districts/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (req.auth?.role === 'COUNTRY_SYSADMIN') {
    const existing = await prisma.district.findUnique({ where: { id }, include: { province: { select: { countryId: true } } } });
    if (!existing || existing.province.countryId !== req.auth.countryId) {
      res.status(403).json({ error: 'District is not in your country' }); return;
    }
  }
  const childCount = await prisma.lovArea.count({ where: { districtId: id } });
  if (childCount > 0) {
    res.status(409).json({ error: `Cannot delete — this district has ${childCount} area(s). Delete them first.` }); return;
  }
  try {
    await prisma.district.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(409).json({ error: 'Cannot delete — district may still have linked data.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AREAS  (CountrySysAdmin+: geographic areas tied to a district)
// ══════════════════════════════════════════════════════════════════════════════

router.get('/areas', async (req, res) => {
  const districtId = req.query.districtId ? parseInt(req.query.districtId as string, 10) : undefined;
  const countryId  = req.query.countryId  ? parseInt(req.query.countryId  as string, 10) : undefined;
  const rows = await prisma.lovArea.findMany({
    where: {
      isActive: true,
      organisationId: null, // geographic areas only (not org-specific LOV areas)
      ...(districtId ? { districtId } : {}),
      ...(countryId  ? { district: { province: { countryId } } } : {}),
    },
    orderBy: { value: 'asc' },
    include: {
      district: {
        select: { name: true, province: { select: { name: true, country: { select: { name: true } } } } },
      },
    },
  });
  res.json(rows);
});

router.post('/areas', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const { value, districtId } = req.body as { value: string; districtId: number };
  if (!value || !districtId) { res.status(400).json({ error: 'value and districtId required' }); return; }
  if (req.auth?.role === 'COUNTRY_SYSADMIN') {
    const district = await prisma.district.findUnique({
      where: { id: Number(districtId) },
      include: { province: { select: { countryId: true } } },
    });
    if (!district || district.province.countryId !== req.auth.countryId) {
      res.status(403).json({ error: 'District is not in your country' }); return;
    }
  }
  const row = await prisma.lovArea.create({
    data: { value, districtId: Number(districtId), organisationId: null },
    include: { district: { select: { name: true, province: { select: { name: true, country: { select: { name: true } } } } } } },
  });
  res.status(201).json(row);
});

router.put('/areas/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (req.auth?.role === 'COUNTRY_SYSADMIN') {
    const existing = await prisma.lovArea.findUnique({
      where: { id },
      include: { district: { include: { province: { select: { countryId: true } } } } },
    });
    if (!existing || !existing.district || existing.district.province.countryId !== req.auth.countryId) {
      res.status(403).json({ error: 'Area is not in your country' }); return;
    }
  }
  const { value, isActive } = req.body;
  const row = await prisma.lovArea.update({ where: { id }, data: { value, isActive } });
  res.json(row);
});

router.delete('/areas/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (req.auth?.role === 'COUNTRY_SYSADMIN') {
    const existing = await prisma.lovArea.findUnique({
      where: { id },
      include: { district: { include: { province: { select: { countryId: true } } } } },
    });
    if (!existing || !existing.district || existing.district.province.countryId !== req.auth.countryId) {
      res.status(403).json({ error: 'Area is not in your country' }); return;
    }
  }
  const orgCount = await prisma.organisation.count({ where: { areaId: id } });
  if (orgCount > 0) {
    res.status(409).json({ error: `Cannot delete — ${orgCount} organisation(s) reference this area.` }); return;
  }
  try {
    await prisma.lovArea.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(409).json({ error: 'Cannot delete — area may still have linked data.' });
  }
});

// ── GroupAdmin area management (org-scoped areas via requireGroupSysAdmin) ───────

router.get('/group-areas', requireAuth, requireGroupSysAdmin, async (req: Request, res: Response) => {
  const organisationId = req.auth?.organisationId;
  if (!organisationId) { res.status(403).json({ error: 'No organisation assigned' }); return; }
  const rows = await prisma.lovArea.findMany({
    where: { organisationId },
    orderBy: { value: 'asc' },
  });
  res.json(rows);
});

router.post('/group-areas', requireAuth, requireGroupSysAdmin, async (req: Request, res: Response) => {
  const organisationId = req.auth?.organisationId;
  if (!organisationId) { res.status(403).json({ error: 'No organisation assigned' }); return; }
  const { value } = req.body as { value: string };
  if (!value?.trim()) { res.status(400).json({ error: 'value is required' }); return; }
  const row = await prisma.lovArea.create({
    data: { value: value.trim(), organisationId, districtId: null },
  });
  res.status(201).json(row);
});

router.put('/group-areas/:id', requireAuth, requireGroupSysAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const organisationId = req.auth?.organisationId;
  const existing = await prisma.lovArea.findUnique({ where: { id }, select: { organisationId: true } });
  if (!existing || existing.organisationId !== organisationId) {
    res.status(403).json({ error: 'Area does not belong to your organisation' }); return;
  }
  const { value, isActive } = req.body;
  const row = await prisma.lovArea.update({ where: { id }, data: { value, isActive } });
  res.json(row);
});

router.delete('/group-areas/:id', requireAuth, requireGroupSysAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const organisationId = req.auth?.organisationId;
  const existing = await prisma.lovArea.findUnique({ where: { id }, select: { organisationId: true } });
  if (!existing || existing.organisationId !== organisationId) {
    res.status(403).json({ error: 'Area does not belong to your organisation' }); return;
  }
  try {
    await prisma.lovArea.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(409).json({ error: 'Cannot delete — area may still have linked incidents.' });
  }
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
      area:     { select: { value: true } },
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
      area:     { select: { value: true } },
      _count:   { select: { responders: true, incidents: true } },
    },
  });
  res.json(rows);
});

router.post('/organisations', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const { name, countryId, provinceId, districtId, areaId } = req.body as {
    name: string; countryId: number; provinceId: number; districtId: number; areaId?: number;
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
    data: {
      name, countryId, provinceId, districtId,
      ...(areaId ? { areaId } : {}),
      approvedAt: new Date(),
      approvedById: req.auth?.adminUserId,
    },
    include: {
      country:  { select: { name: true } },
      province: { select: { name: true } },
      district: { select: { name: true } },
      area:     { select: { value: true } },
    },
  });
  res.status(201).json(row);
});

router.put('/organisations/:id', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const { name, isActive, districtId, provinceId, countryId, areaId } = req.body;
  if (name && name.length > 40) {
    res.status(400).json({ error: 'Organisation name must be 40 characters or fewer' });
    return;
  }
  const row = await prisma.organisation.update({
    where: { id: parseInt(req.params.id, 10) },
    data: { name, isActive, districtId, provinceId, countryId, areaId: areaId ?? null },
    include: {
      country:  { select: { name: true } },
      province: { select: { name: true } },
      district: { select: { name: true } },
      area:     { select: { value: true } },
    },
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
// GROUP ADMINS  (CountrySysAdmin+ creates GROUP_SYSADMIN / GROUP_ADMIN)
// ══════════════════════════════════════════════════════════════════════════════

router.post('/group-admins', requireAuth, requireCountrySysAdmin, async (req: Request, res: Response) => {
  const { orgId, firstName, surname, email, mobile, password, role = 'GROUP_SYSADMIN' } = req.body as {
    orgId: number; firstName: string; surname: string;
    email: string; mobile?: string; password: string;
    role?: 'GROUP_SYSADMIN' | 'GROUP_ADMIN';
  };
  if (!orgId || !firstName || !surname || !email || !password) {
    res.status(400).json({ error: 'orgId, firstName, surname, email and password are required' }); return;
  }
  if (!['GROUP_SYSADMIN', 'GROUP_ADMIN'].includes(role)) {
    res.status(400).json({ error: 'role must be GROUP_SYSADMIN or GROUP_ADMIN' }); return;
  }
  // CountrySysAdmin: verify org is in their country
  const org = await prisma.organisation.findUnique({
    where: { id: Number(orgId) },
  });
  if (!org) { res.status(404).json({ error: 'Organisation not found' }); return; }
  if (req.auth?.role === 'COUNTRY_SYSADMIN' && org.countryId !== req.auth.countryId) {
    res.status(403).json({ error: 'Organisation is not in your country' }); return;
  }
  const username   = await generateUsername(firstName, surname, org.countryId);
  const passwordHash = await bcrypt.hash(password, 12);
  const responder  = await prisma.lovResponder.create({
    data: {
      value: `${firstName} ${surname}`.trim(),
      firstName, surname, email: email.toLowerCase(), mobile: mobile ?? null,
      username, organisationId: Number(orgId),
      role,
      isAdmin:    true,
      isSysAdmin: role === 'GROUP_SYSADMIN',
      passwordHash,
      mustChangePassword: true,
    },
    select: { id: true, value: true, firstName: true, surname: true, email: true, username: true, role: true },
  });
  res.status(201).json(responder);
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN USERS  (SuperAdmin only)
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

    // Generate username using new country-scoped counter formula
    const username = await generateUsername(firstName, surname, reg.countryId);

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
        mustChangePassword: true,
      },
      select: { id: true, value: true, firstName: true, surname: true, email: true, username: true },
    });

    // Send temp password to the contact email
    const resend = getResend();
    if (reg.contactEmail && resend) {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: reg.contactEmail,
        subject: 'FirstResponders — Organisation Approved',
        html: `
          <p>Hi ${firstName},</p>
          <p>Your organisation <strong>${org.name}</strong> has been approved on FirstResponders.</p>
          <p><strong>Your login credentials:</strong></p>
          <ul>
            <li><strong>Username:</strong> ${username ?? 'See admin for username'}</li>
            <li><strong>Temporary Password:</strong> ${tempPassword}</li>
          </ul>
          <p>Please log in at your earliest opportunity and change your password.</p>
          <p>This password will not be shown again.</p>
        `,
      });
    }

    res.json({ registration: reg, organisation: org, groupSysAdmin, tempPassword });
    return;
  }

  res.json({ registration: reg });
});

export default router;
