import { prisma } from '../lib/prisma';
import { Router, Request, Response } from 'express';

import { requireAuth, requireAdmin, requireSysAdmin } from '../middleware/auth';

const router = Router();


// ─── GET /api/admin/audit-log ─────────────────────────────────────────────────
router.get('/audit-log', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { limit = '100', offset = '0', table } = req.query as Record<string, string>;
  const where = table ? { tableName: table } : {};
  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { changedAt: 'desc' },
    take: parseInt(limit, 10),
    skip: parseInt(offset, 10),
  });
  res.json(entries);
});

// ─── GET /api/admin/stats  (monthly summary) ─────────────────────────────────
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // ── Scope incidents by role ──────────────────────────────────────────────────
  const role = req.auth?.role as string | undefined;
  const incidentWhere: Record<string, unknown> = {};
  if (role === 'COUNTRY_SYSADMIN' && req.auth?.countryId) {
    incidentWhere.organisation = { countryId: req.auth.countryId };
  } else if (
    (role === 'GROUP_SYSADMIN' || role === 'GROUP_ADMIN' || role === 'RESPONDER') &&
    req.auth?.organisationId
  ) {
    incidentWhere.organisation = { id: req.auth.organisationId };
  }
  // SUPER_ADMIN: no restriction — sees global stats

  // Patient where clause mirrors incident restriction via nested relation
  const patientWhere: Record<string, unknown> = Object.keys(incidentWhere).length > 0
    ? { incident: incidentWhere }
    : {};

  const [totalIncidents, totalPatients, callTypeCounts, recentIncidents] = await Promise.all([
    prisma.incident.count({ where: incidentWhere }),
    prisma.patient.count({ where: patientWhere }),
    prisma.incident.groupBy({
      by: ['callTypeId'],
      where: incidentWhere,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    // Fetch recent incidents for month grouping (Prisma-native, scoped)
    prisma.incident.findMany({
      where: { incidentDate: { gte: twelveMonthsAgo }, ...incidentWhere },
      select: { incidentDate: true },
    }),
  ]);

  // Build monthly counts in JS (avoids raw SQL scoping complexity)
  const monthMap = new Map<string, number>();
  for (const inc of recentIncidents) {
    const month = inc.incidentDate.toISOString().slice(0, 7); // 'YYYY-MM'
    monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
  }
  const monthlyIncidents = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  const callTypeIds = callTypeCounts.map((c) => c.callTypeId).filter(Boolean) as number[];
  const callTypeNames = await prisma.lovCallType.findMany({
    where: { id: { in: callTypeIds } },
    select: { id: true, value: true },
  });
  const nameMap = Object.fromEntries(callTypeNames.map((c) => [c.id, c.value]));

  res.json({
    totalIncidents,
    totalPatients,
    topCallTypes: callTypeCounts.map((c) => ({
      callType: c.callTypeId ? nameMap[c.callTypeId] ?? 'Unknown' : 'Unknown',
      count: c._count.id,
    })),
    monthlyIncidents,
  });
});

// ─── GET /api/admin/users  (SysAdmin only) ────────────────────────────────────
router.get('/users', requireAuth, requireSysAdmin, async (req: Request, res: Response) => {
  const role = req.auth?.role as string | undefined;
  const isSuperAdmin   = role === 'SUPER_ADMIN';
  const isCountryAdmin = role === 'COUNTRY_SYSADMIN';
  const canSeeUsername = isSuperAdmin || isCountryAdmin;

  // GROUP_SYSADMIN sees only their own org's responders
  const where: Record<string, unknown> = role === 'GROUP_SYSADMIN'
    ? { organisationId: req.auth?.organisationId }
    : {};

  const users = await prisma.lovResponder.findMany({
    where,
    orderBy: [{ organisation: { name: 'asc' } }, { sortOrder: 'asc' }],
    select: {
      id: true, value: true, firstName: true, surname: true,
      email: true, mobile: true,
      ...(canSeeUsername ? { username: true } : {}),
      isAdmin: true, isSysAdmin: true, isActive: true,
      organisation: {
        select: {
          id: true, name: true,
          country:  { select: { id: true, name: true } },
          province: { select: { id: true, name: true } },
        },
      },
    },
  });
  res.json(users);
});

// ─── PATCH /api/admin/users/:id/role  (SysAdmin only) ────────────────────────
router.patch('/users/:id/role', requireAuth, requireSysAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { isAdmin, isSysAdmin, isActive } = req.body as {
    isAdmin?: boolean;
    isSysAdmin?: boolean;
    isActive?: boolean;
  };

  // GROUP_SYSADMIN: only manage their own org; cannot grant isSysAdmin
  if (req.auth?.role === 'GROUP_SYSADMIN') {
    const target = await prisma.lovResponder.findUnique({ where: { id }, select: { organisationId: true } });
    if (!target || target.organisationId !== req.auth.organisationId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    if (typeof isSysAdmin === 'boolean' && isSysAdmin) {
      res.status(403).json({ error: 'Cannot grant SysAdmin role' });
      return;
    }
  }

  const data: Record<string, boolean> = {};
  if (typeof isAdmin === 'boolean') data.isAdmin = isAdmin;
  if (typeof isSysAdmin === 'boolean') data.isSysAdmin = isSysAdmin;
  if (typeof isActive === 'boolean') data.isActive = isActive;

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  const user = await prisma.lovResponder.update({
    where: { id },
    data,
    select: { id: true, value: true, firstName: true, surname: true, email: true, mobile: true, isAdmin: true, isSysAdmin: true, isActive: true, username: true },
  });

  res.json(user);
});

export default router;
