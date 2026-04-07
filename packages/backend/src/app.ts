import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'path';

import authRouter from './routes/auth';
import lovsRouter from './routes/lovs';
import incidentsRouter from './routes/incidents';
import photosRouter from './routes/photos';
import adminRouter from './routes/admin';
import hierarchyRouter from './routes/hierarchy';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') ?? []
    : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static uploads (dev only — use CDN/S3 in prod) ──────────────────────────
const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/lovs', lovsRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/admin', adminRouter);
app.use('/api/hierarchy', hierarchyRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FirstResponders API running on http://localhost:${PORT}`);
  console.log(`Mobile devices: http://192.168.68.102:${PORT}`);
});

export default app;
