import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData?: boolean,
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData
      ? (body as FormData)
      : body !== undefined
      ? JSON.stringify(body)
      : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? 'Request failed'), { statusCode: res.status });
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Auth — public endpoints (no token required)
  getOrganisations: () =>
    request<{ id: number; name: string; country?: { name: string } }[]>('GET', '/api/auth/organisations'),
  getResponders: (orgId?: number) =>
    request<{ id: number; value: string; firstName?: string | null; surname?: string | null; isAdmin: boolean; email?: string; mobile?: string }[]>(
      'GET', `/api/auth/responders${orgId ? `?orgId=${orgId}` : ''}`,
    ),
  createSession: (username: string, pin: string) =>
    request<{
      token: string;
      responderId: number; responderName: string; firstName?: string; surname?: string;
      organisationId?: number; organisationName?: string;
      countryId?: number; countryName?: string;
      role: string; isAdmin: boolean; isSysAdmin: boolean;
    }>('POST', '/api/auth/session', { username, pin }),

  // LOVs
  getLov: (table: string, params?: { includeInactive?: boolean; areaId?: number }) => {
    const qs = new URLSearchParams();
    if (params?.includeInactive) qs.set('includeInactive', 'true');
    if (params?.areaId !== undefined) qs.set('areaId', String(params.areaId));
    const q = qs.toString();
    return request<unknown[]>('GET', `/api/lovs/${table}${q ? `?${q}` : ''}`);
  },
  getAreas: () => request<unknown[]>('GET', '/api/lovs/areas'),
  addLovValue: (table: string, value: string, extra?: object) =>
    request<unknown>('POST', `/api/lovs/${table}`, { value, ...extra }),

  // Incidents
  getIncidents: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return request<{ total: number; items: unknown[] }>('GET', `/api/incidents${qs}`);
  },
  getIncident: (id: number) => request<unknown>('GET', `/api/incidents/${id}`),
  createIncident: (data: unknown) => request<unknown>('POST', '/api/incidents', data),
  updateIncident: (id: number, data: unknown) =>
    request<unknown>('PUT', `/api/incidents/${id}`, data),

  // Photos
  uploadPhoto: (
    incidentId: number,
    fileUri: string,
    meta: { latitude?: number; longitude?: number; altitude?: number; patientId?: number; capturedAt: string },
  ) => {
    const form = new FormData();
    form.append('photo', { uri: fileUri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
    if (meta.latitude != null) form.append('latitude', String(meta.latitude));
    if (meta.longitude != null) form.append('longitude', String(meta.longitude));
    if (meta.altitude != null) form.append('altitude', String(meta.altitude));
    if (meta.patientId != null) form.append('patientId', String(meta.patientId));
    form.append('capturedAt', meta.capturedAt);
    return request<unknown>('POST', `/api/incidents/${incidentId}/photos`, form, true);
  },
};
