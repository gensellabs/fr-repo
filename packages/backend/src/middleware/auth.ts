import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'COUNTRY_SYSADMIN'
  | 'GROUP_SYSADMIN'
  | 'GROUP_ADMIN'
  | 'RESPONDER';

export interface AuthPayload {
  // Responder (mobile) auth
  responderId?: number;
  responderName?: string;
  organisationId?: number;
  // Admin (web) auth
  adminUserId?: number;
  adminName?: string;
  countryId?: number;
  // Shared
  role: UserRole;
  isAdmin: boolean;
  isSysAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export function requireSysAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isSysAdmin) {
    res.status(403).json({ error: 'SysAdmin access required' });
    return;
  }
  next();
}

export function requireGroupSysAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.auth?.role;
  if (role !== 'GROUP_SYSADMIN' && role !== 'COUNTRY_SYSADMIN' && role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Group SysAdmin access required' });
    return;
  }
  next();
}

export function requireCountrySysAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.auth?.role;
  if (role !== 'COUNTRY_SYSADMIN' && role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Country SysAdmin access required' });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Super Admin access required' });
    return;
  }
  next();
}
