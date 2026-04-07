import { prisma } from '../lib/prisma';
import { Router, Request, Response } from 'express';

import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

// ─── GET /api/photos/:id  (role-scoped) ──────────────────────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const photo = await prisma.incidentPhoto.findUnique({
    where: { id: parseInt(req.params.id, 10) },
    include: {
      incident: {
        include: { organisation: true },
      },
    },
  });
  if (!photo) {
    res.status(404).json({ error: 'Photo not found' });
    return;
  }

  // ── Role-based access check ─────────────────────────────────────────────
  const { role, countryId, organisationId } = req.auth!;
  const incidentOrgId = photo.incident.organisationId;
  const incidentCountryId = photo.incident.organisation?.countryId ?? null;

  if (role === 'SUPER_ADMIN') {
    // Full access — no restriction
  } else if (role === 'COUNTRY_SYSADMIN') {
    if (incidentCountryId !== countryId) {
      res.status(403).json({ error: 'Photo not in your country' });
      return;
    }
  } else {
    // Responders / Group admins — own organisation only
    if (incidentOrgId !== organisationId) {
      res.status(403).json({ error: 'Photo not in your group' });
      return;
    }
  }

  const filePath = path.join(UPLOAD_DIR, photo.storagePath);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Photo file not found on disk' });
    return;
  }
  res.sendFile(path.resolve(filePath));
});

// ─── DELETE /api/photos/:id ───────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const photo = await prisma.incidentPhoto.findUnique({
    where: { id: parseInt(req.params.id, 10) },
    include: { incident: { select: { organisationId: true } } },
  });
  if (!photo) {
    res.status(404).json({ error: 'Photo not found' });
    return;
  }

  // GROUP roles can only delete photos from their own org's incidents
  const { role, organisationId } = req.auth!;
  const isGroupRole = role === 'GROUP_SYSADMIN' || role === 'GROUP_ADMIN' || role === 'RESPONDER';
  if (isGroupRole && photo.incident.organisationId !== organisationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Delete file from disk
  const filePath = path.join(UPLOAD_DIR, photo.storagePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await prisma.incidentPhoto.delete({ where: { id: photo.id } });
  res.status(204).send();
});

export default router;
