import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

export interface AuthState {
  responderId: number;
  responderName: string;
  organisationId?: number;
  organisationName?: string;
  countryId?: number;
  countryName?: string;
  role?: string;
  isAdmin: boolean;
  isSysAdmin?: boolean;
  token: string;
}

const TOKEN_KEY = 'auth_token';
const SESSION_KEY = 'auth_session';

export async function login(username: string, pin: string): Promise<AuthState> {
  const session = await api.createSession(username, pin);
  const state: AuthState = {
    responderId: session.responderId,
    responderName: session.responderName,
    organisationId: session.organisationId,
    organisationName: session.organisationName,
    countryId: session.countryId,
    countryName: session.countryName,
    role: session.role,
    isAdmin: session.isAdmin,
    isSysAdmin: session.isSysAdmin,
    token: session.token,
  };
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(state));
  return state;
}

export async function getStoredSession(): Promise<AuthState | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
