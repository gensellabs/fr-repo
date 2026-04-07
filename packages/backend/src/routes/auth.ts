import { prisma } from '../lib/prisma';
import { Router, Request, Response } from 'express';

import bcrypt from 'bcryptjs';
import { signToken } from '../middleware/auth';

const router = Router();


// ─── GET /api/auth/responders  ─ public, mobile login screen ─────────────────
// Returns all active responders for a given org (or org 1 if no orgId provided)
router.get('/responders', async (req: Request, res: Response) => {
  const orgId = req.query.orgId ? parseInt(req.query.orgId as string, 10) : 1;
  const responders = await prisma.lovResponder.findMany({
    where: { isActive: true, organisationId: orgId },
    select: {
      id: true, value: true, firstName: true, surname: true,
      isAdmin: true, isSysAdmin: true, role: true,
      email: true, mobile: true,
      organisation: { select: { id: true, name: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(responders);
});

// ─── GET /api/auth/organisations  ─ public, for org selection on mobile ───────
router.get('/organisations', async (_req: Request, res: Response) => {
  const orgs = await prisma.organisation.findMany({
    where: { isActive: true },
    select: { id: true, name: true, country: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(orgs);
});

// ─── POST /api/auth/session  ─ responder login via username + PIN ─────────────
// PIN = last 4 digits of the responder's mobile number
router.post('/session', async (req: Request, res: Response) => {
  const { username, pin } = req.body as { username?: string; pin?: string };
  if (!username || !pin) {
    res.status(400).json({ error: 'username and pin are required' });
    return;
  }

  const responder = await prisma.lovResponder.findFirst({
    where: { username: username.trim().toLowerCase(), isActive: true },
    include: {
      organisation: {
        select: {
          id: true, name: true,
          country: { select: { id: true, name: true, isoCode: true } },
        },
      },
    },
  });

  // Derive PIN from mobile: last 4 digits only
  const expectedPin = responder?.mobile?.replace(/\D/g, '').slice(-4) ?? null;

  if (!responder || !expectedPin || pin !== expectedPin) {
    res.status(401).json({ error: 'Invalid username or PIN' });
    return;
  }

  await prisma.lovResponder.update({ where: { id: responder.id }, data: { lastLoginAt: new Date() } });

  const countryId = responder.organisation?.country?.id ?? undefined;

  const token = signToken({
    responderId: responder.id,
    responderName: responder.value,
    organisationId: responder.organisationId ?? undefined,
    countryId,
    role: responder.role as any,
    isAdmin: responder.isAdmin,
    isSysAdmin: responder.isSysAdmin,
  });

  res.json({
    responderId: responder.id,
    responderName: responder.value,
    firstName: responder.firstName,
    surname: responder.surname,
    organisationId: responder.organisationId,
    organisationName: responder.organisation?.name,
    countryId,
    countryName: responder.organisation?.country?.name,
    role: responder.role,
    isAdmin: responder.isAdmin,
    isSysAdmin: responder.isSysAdmin,
    token,
  });
});

// ─── POST /api/auth/admin-login  ─ admin login (web) ─────────────────────────
// Accepts AdminUser (SUPER_ADMIN / COUNTRY_SYSADMIN) or LovResponder with isAdmin=true
router.post('/admin-login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // ── Try AdminUser first ────────────────────────────────────────────────────
  const admin = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail, isActive: true },
    include: { country: { select: { id: true, name: true } } },
  });
  if (admin) {
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    const token = signToken({
      adminUserId: admin.id,
      adminName: admin.name,
      countryId: admin.countryId ?? undefined,
      role: admin.role as any,
      isAdmin: true,
      isSysAdmin: true,
    });
    res.json({
      adminUserId: admin.id,
      adminName: admin.name,
      email: admin.email,
      role: admin.role,
      countryId: admin.countryId,
      countryName: admin.country?.name,
      isAdmin: true,
      isSysAdmin: true,
      token,
    });
    return;
  }

  // ── Try GROUP_SYSADMIN / GROUP_ADMIN LovResponder ─────────────────────────
  const responder = await prisma.lovResponder.findFirst({
    where: { email: normalizedEmail, isActive: true, isAdmin: true },
    include: {
      organisation: {
        select: {
          id: true, name: true,
          country: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (responder && responder.passwordHash) {
    const valid = await bcrypt.compare(password, responder.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    await prisma.lovResponder.update({ where: { id: responder.id }, data: { lastLoginAt: new Date() } });
    const role = responder.isSysAdmin ? 'GROUP_SYSADMIN' : 'GROUP_ADMIN';
    const groupCountryId = responder.organisation?.country?.id ?? undefined;
    const token = signToken({
      responderId: responder.id,
      responderName: responder.value,
      organisationId: responder.organisationId ?? undefined,
      countryId: groupCountryId,
      role: role as any,
      isAdmin: responder.isAdmin,
      isSysAdmin: responder.isSysAdmin,
    });
    res.json({
      responderId: responder.id,
      responderName: responder.value,
      organisationId: responder.organisationId,
      organisationName: responder.organisation?.name,
      countryId: groupCountryId,
      countryName: responder.organisation?.country?.name,
      role,
      isAdmin: responder.isAdmin,
      isSysAdmin: responder.isSysAdmin,
      token,
    });
    return;
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

export default router;
