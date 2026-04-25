import { prisma } from '../lib/prisma';
import { Router, Request, Response } from 'express';

import bcrypt from 'bcryptjs';
import { signToken, requireAuth } from '../middleware/auth';

const router = Router();

// ─── Password validation rules ────────────────────────────────────────────────
function validateNewPassword(password: string): string | null {
  if (password.length < 12)          return 'Password must be at least 12 characters long';
  if (!/[A-Z]/.test(password))       return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password))       return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password))       return 'Password must contain at least one digit (0–9)';
  if (!/[@#&%!]/.test(password))     return 'Password must contain at least one special character (@, #, &, %, !)';
  return null;
}

const DEFAULT_PASSWORD = 'Password!12@';

// ─── GET /api/auth/responders  ─ public, mobile login screen ─────────────────
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

// ─── POST /api/auth/session  ─ responder login ───────────────────────────────
// Mobile:  body = { username, pin }      → validates PIN (last 4 digits of mobile)
// Web:     body = { username, password } → validates bcrypt password hash
router.post('/session', async (req: Request, res: Response) => {
  const { username, pin, password } = req.body as {
    username?: string;
    pin?: string;
    password?: string;
  };

  if (!username) {
    res.status(400).json({ error: 'username is required' });
    return;
  }
  if (!pin && !password) {
    res.status(400).json({ error: 'pin or password is required' });
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

  if (!responder) {
    res.status(401).json({ error: 'Invalid username or credentials' });
    return;
  }

  // ── Password-based login (web) ─────────────────────────────────────────────
  if (password) {
    if (!responder.passwordHash) {
      // No hash set yet — accept the default password once and force change
      if (password !== DEFAULT_PASSWORD) {
        res.status(401).json({ error: 'Invalid username or password' });
        return;
      }
    } else {
      const valid = await bcrypt.compare(password, responder.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid username or password' });
        return;
      }
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
      mustChangePassword: responder.mustChangePassword,
      token,
    });
    return;
  }

  // ── PIN-based login (mobile — unchanged) ──────────────────────────────────
  const expectedPin = responder.mobile?.replace(/\D/g, '').slice(-4) ?? null;
  if (!expectedPin || pin !== expectedPin) {
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
      mustChangePassword: false,
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
      mustChangePassword: responder.mustChangePassword,
      token,
    });
    return;
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
// Requires auth. Changes the password for the logged-in responder.
// Body: { currentPassword: string, newPassword: string }
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  const responderId = req.auth?.responderId;
  if (!responderId) {
    res.status(403).json({ error: 'Only responder accounts can change password here' });
    return;
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' });
    return;
  }

  const responder = await prisma.lovResponder.findUnique({ where: { id: responderId } });
  if (!responder) {
    res.status(404).json({ error: 'Responder not found' });
    return;
  }

  // Verify current password
  let currentValid = false;
  if (responder.passwordHash) {
    currentValid = await bcrypt.compare(currentPassword, responder.passwordHash);
  } else {
    // No hash yet — accept the default password
    currentValid = currentPassword === DEFAULT_PASSWORD;
  }
  if (!currentValid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  // Validate new password rules
  const ruleError = validateNewPassword(newPassword);
  if (ruleError) {
    res.status(400).json({ error: ruleError });
    return;
  }

  // Must be different from current
  if (currentPassword === newPassword) {
    res.status(400).json({ error: 'New password must be different from current password' });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.lovResponder.update({
    where: { id: responderId },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  res.json({ ok: true });
});

export default router;
