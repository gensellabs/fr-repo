import { useState } from 'react';
import { apiClient } from '../api/client';

export interface AuthState {
  // Responder auth (mobile-style / web responder login)
  responderId?: number;
  responderName?: string;
  organisationId?: number;
  organisationName?: string;
  // Admin auth (email+password)
  adminUserId?: number;
  adminName?: string;
  countryId?: number;
  countryName?: string;
  // Shared
  role: string;
  isAdmin: boolean;
  isSysAdmin: boolean;
  // Password lifecycle
  mustChangePassword?: boolean;
  // Discriminator: how the user authenticated
  loginMethod?: 'admin' | 'session';
}

const SESSION_KEY = 'auth_session';

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Web responder login — username + password
  async function login(username: string, password: string) {
    const session = await apiClient.createSession(username, password);
    const state: AuthState = {
      responderId: session.responderId,
      responderName: session.responderName,
      organisationId: session.organisationId,
      organisationName: session.organisationName,
      countryId: session.countryId,
      countryName: session.countryName,
      role: session.role ?? 'RESPONDER',
      isAdmin: session.isAdmin,
      isSysAdmin: session.isSysAdmin ?? false,
      mustChangePassword: session.mustChangePassword ?? false,
      loginMethod: 'session',
    };
    localStorage.setItem('auth_token', session.token);
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
    setAuth(state);
    return state;
  }

  // Admin login — email + password (AdminUser or GROUP_SYSADMIN/GROUP_ADMIN)
  async function adminLogin(email: string, password: string) {
    const session = await apiClient.adminLogin(email, password);
    const state: AuthState = {
      adminUserId: session.adminUserId,
      adminName: session.adminName,
      responderId: session.responderId,
      responderName: session.responderName,
      organisationId: session.organisationId,
      organisationName: session.organisationName,
      countryId: session.countryId,
      countryName: session.countryName,
      role: session.role,
      isAdmin: session.isAdmin,
      isSysAdmin: session.isSysAdmin,
      mustChangePassword: session.mustChangePassword ?? false,
      loginMethod: 'admin',
    };
    localStorage.setItem('auth_token', session.token);
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
    setAuth(state);
    return state;
  }

  // Call after a successful password change to clear the forced-change flag
  function clearMustChangePassword() {
    if (!auth) return;
    const updated = { ...auth, mustChangePassword: false };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setAuth(updated);
  }

  function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem(SESSION_KEY);
    setAuth(null);
  }

  return { auth, login, adminLogin, clearMustChangePassword, logout };
}
