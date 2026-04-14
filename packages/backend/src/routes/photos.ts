import { prisma } from '../lib/prisma';
import { Router, Request, Response } from 'express';
import { GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { requireAuth } from '../middleware/auth';
import { r2, R2_BUCKET } from '../lib/r2';

const router = Router();

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
    if (incidentOrgId !== organisationId) {
      res.status(403).json({ error: 'Photo not in your group' });
      return;
    }
  }

  // ── Stream from R2 ──────────────────────────────────────────────────────
  const result = await r2.send(new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: photo.storagePath,
  }));

  if (!result.Body) {
    res.status(404).json({ error: 'Photo file not found in storage' });
    return;
  }

  res.setHeader('Content-Type', result.ContentType ?? 'image/jpeg');
  if (result.ContentLength) res.setHeader('Content-Length', result.ContentLength);
  (result.Body as Readable).pipe(res);
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

  const { role, organisationId } = req.auth!;
  const isGroupRole = role === 'GROUP_SYSADMIN' || role === 'GROUP_ADMIN' || role === 'RESPONDER';
  if (isGroupRole && photo.incident.organisationId !== organisationId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Delete from R2 then database
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: photo.storagePath }));
  await prisma.incidentPhoto.delete({ where: { id: photo.id } });
  res.status(204).send();
});

export default router;
