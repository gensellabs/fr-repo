const BASE = import.meta.env.VITE_API_URL ?? '';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function request<T>(method: string, path: string, body?: unknown, isFormData?: boolean): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
  };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? 'Request failed'), { status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),

  // LOVs
  getLov: <T = unknown[]>(table: string, params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return request<T>('GET', `/api/lovs/${table}${qs}`);
  },
  getAreas: () => request<unknown[]>('GET', '/api/lovs/areas'),
  addLovValue: (table: string, value: string, extra?: object) =>
    request<unknown>('POST', `/api/lovs/${table}`, { value, ...extra }),
  updateLovValue: (table: string, id: number, data: object) =>
    request<unknown>('PUT', `/api/lovs/${table}/${id}`, data),
  deactivateLovValue: (table: string, id: number) =>
    request<unknown>('PATCH', `/api/lovs/${table}/${id}/deactivate`),
  deleteLovValue: (table: string, id: number) =>
    request<unknown>('DELETE', `/api/lovs/${table}/${id}`),
  reorderLovValue: (table: string, id: number, sortOrder: number) =>
    request<unknown>('PATCH', `/api/lovs/${table}/${id}/reorder`, { sortOrder }),

  // Incidents
  getIncidents: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return request<{ total: number; items: unknown[] }>('GET', `/api/incidents${qs}`);
  },
  getIncident: (id: number) => request<unknown>('GET', `/api/incidents/${id}`),
  createIncident: (data: unknown) => request<unknown>('POST', '/api/incidents', data),
  updateIncident: (id: number, data: unknown) => request<unknown>('PUT', `/api/incidents/${id}`, data),
  exportCsv: () => fetch('/api/incidents/export/csv', { headers: { Authorization: `Bearer ${getToken()}` } }),

  // Admin
  getAuditLog: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return request<unknown[]>('GET', `/api/admin/audit-log${qs}`);
  },
  getStats: () => request<unknown>('GET', '/api/admin/stats'),

  // Auth
  createSession: (username: string, pin: string) =>
    request<{
      token: string;
      responderId: number; responderName: string; firstName?: string; surname?: string;
      organisationId?: number; organisationName?: string;
      countryId?: number; countryName?: string;
      role: string; isAdmin: boolean; isSysAdmin: boolean;
    }>('POST', '/api/auth/session', { username, pin }),
  adminLogin: (email: string, password: string) =>
    request<{
      token: string;
      // AdminUser fields
      adminUserId?: number; adminName?: string; email?: string;
      // GROUP_SYSADMIN / GROUP_ADMIN fields
      responderId?: number; responderName?: string;
      organisationId?: number; organisationName?: string;
      // Shared (present for both AdminUser and GROUP roles)
      countryId?: number; countryName?: string;
      role: string; isAdmin: boolean; isSysAdmin: boolean;
    }>('POST', '/api/auth/admin-login', { email, password }),

  // User management (SysAdmin only)
  getUsers: () => request<{
    id: number; value: string; firstName?: string | null; surname?: string | null;
    username?: string | null; email?: string | null; mobile?: string | null;
    isAdmin: boolean; isSysAdmin: boolean; isActive: boolean;
    organisation?: { id: number; name: string; country?: { id: number; name: string }; province?: { id: number; name: string } } | null;
  }[]>('GET', '/api/admin/users'),
  updateUserRole: (id: number, data: { isAdmin?: boolean; isSysAdmin?: boolean; isActive?: boolean; mobile?: string; email?: string }) =>
    request<unknown>('PATCH', `/api/admin/users/${id}/role`, data),

  // Hierarchy (SuperAdmin / CountrySysAdmin)
  getCountries: (all?: boolean) => request<unknown[]>('GET', `/api/hierarchy/countries${all ? '/all' : ''}`),
  createCountry: (data: unknown) => request<unknown>('POST', '/api/hierarchy/countries', data),
  updateCountry: (id: number, data: unknown) => request<unknown>('PUT', `/api/hierarchy/countries/${id}`, data),
  deleteCountry: (id: number) => request<unknown>('DELETE', `/api/hierarchy/countries/${id}`),

  // Regions (aka Provinces in DB — all calls use /provinces endpoint)
  getRegions: (countryId?: number) => request<unknown[]>('GET', `/api/hierarchy/provinces${countryId ? `?countryId=${countryId}` : ''}`),
  createRegion: (data: unknown) => request<unknown>('POST', '/api/hierarchy/provinces', data),
  updateRegion: (id: number, data: unknown) => request<unknown>('PUT', `/api/hierarchy/provinces/${id}`, data),
  deleteRegion: (id: number) => request<unknown>('DELETE', `/api/hierarchy/provinces/${id}`),
  // Legacy aliases (used by OrganisationsPage etc.)
  getProvinces: (countryId?: number) => request<unknown[]>('GET', `/api/hierarchy/provinces${countryId ? `?countryId=${countryId}` : ''}`),
  createProvince: (data: unknown) => request<unknown>('POST', '/api/hierarchy/provinces', data),
  updateProvince: (id: number, data: unknown) => request<unknown>('PUT', `/api/hierarchy/provinces/${id}`, data),

  getDistricts: (provinceId?: number, countryId?: number) => {
    const params = new URLSearchParams();
    if (provinceId) params.set('provinceId', String(provinceId));
    if (countryId)  params.set('countryId',  String(countryId));
    const qs = params.toString() ? `?${params}` : '';
    return request<unknown[]>('GET', `/api/hierarchy/districts${qs}`);
  },
  createDistrict: (data: unknown) => request<unknown>('POST', '/api/hierarchy/districts', data),
  updateDistrict: (id: number, data: unknown) => request<unknown>('PUT', `/api/hierarchy/districts/${id}`, data),
  deleteDistrict: (id: number) => request<unknown>('DELETE', `/api/hierarchy/districts/${id}`),

  getOrganisations: (params?: { districtId?: number; provinceId?: number; countryId?: number; all?: boolean }) => {
    if (params?.all) return request<unknown[]>('GET', '/api/hierarchy/organisations/all');
    const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)]))}` : '';
    return request<unknown[]>('GET', `/api/hierarchy/organisations${qs}`);
  },
  createOrganisation: (data: unknown) => request<unknown>('POST', '/api/hierarchy/organisations', data),
  updateOrganisation: (id: number, data: unknown) => request<unknown>('PUT', `/api/hierarchy/organisations/${id}`, data),
  deleteOrganisation: (id: number) => request<unknown>('DELETE', `/api/hierarchy/organisations/${id}`),

  // Geographic areas (LovArea with districtId, no organisationId) — CountrySysAdmin+
  getHierarchyAreas: (districtId?: number, countryId?: number) => {
    const params = new URLSearchParams();
    if (districtId) params.set('districtId', String(districtId));
    if (countryId)  params.set('countryId',  String(countryId));
    const qs = params.toString() ? `?${params}` : '';
    return request<unknown[]>('GET', `/api/hierarchy/areas${qs}`);
  },
  createHierarchyArea: (data: unknown) => request<unknown>('POST', '/api/hierarchy/areas', data),
  updateHierarchyArea: (id: number, data: unknown) => request<unknown>('PUT', `/api/hierarchy/areas/${id}`, data),
  deleteHierarchyArea: (id: number) => request<unknown>('DELETE', `/api/hierarchy/areas/${id}`),

  // Group areas (org-scoped LovAreas — GroupSysAdmin+)
  getGroupAreas: () => request<unknown[]>('GET', '/api/hierarchy/group-areas'),
  createGroupArea: (data: unknown) => request<unknown>('POST', '/api/hierarchy/group-areas', data),
  updateGroupArea: (id: number, data: unknown) => request<unknown>('PUT', `/api/hierarchy/group-areas/${id}`, data),
  deleteGroupArea: (id: number) => request<unknown>('DELETE', `/api/hierarchy/group-areas/${id}`),

  // Group Admins (CountrySysAdmin creates GROUP_SYSADMIN / GROUP_ADMIN for an org)
  createGroupAdmin: (data: unknown) => request<unknown>('POST', '/api/hierarchy/group-admins', data),

  getAdminUsers: () => request<unknown[]>('GET', '/api/hierarchy/admin-users'),
  createAdminUser: (data: unknown) => request<unknown>('POST', '/api/hierarchy/admin-users', data),
  updateAdminUser: (id: number, data: unknown) => request<unknown>('PUT', `/api/hierarchy/admin-users/${id}`, data),

  getOrgRegistrations: () => request<unknown[]>('GET', '/api/hierarchy/org-registrations'),
  submitOrgRegistration: (data: unknown) => request<unknown>('POST', '/api/hierarchy/org-registrations', data),
  reviewOrgRegistration: (id: number, data: { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string }) =>
    request<unknown>('PUT', `/api/hierarchy/org-registrations/${id}`, data),
};
