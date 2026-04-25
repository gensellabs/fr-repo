import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

interface UserRow {
  id: number;
  value: string;
  firstName?: string | null;
  surname?: string | null;
  username?: string | null;
  email?: string | null;
  mobile?: string | null;
  isAdmin: boolean;
  isSysAdmin: boolean;
  isActive: boolean;
  organisation?: {
    id: number;
    name: string;
    country?:  { id: number; name: string } | null;
    province?: { id: number; name: string } | null;
    district?: { id: number; name: string } | null;
  } | null;
}

interface DropdownItem { id: number; name: string }

export function UserManagementPage() {
  const { auth } = useAuth();
  const canSeeUsername   = auth?.role === 'SUPER_ADMIN' || auth?.role === 'COUNTRY_SYSADMIN';
  const canSeeOrgCols   = auth?.role === 'SUPER_ADMIN' || auth?.role === 'COUNTRY_SYSADMIN';
  const canEditDetails  = auth?.role === 'SUPER_ADMIN';
  const canResetPassword = auth?.isSysAdmin === true; // GROUP_SYSADMIN, COUNTRY_SYSADMIN, SUPER_ADMIN

  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<number | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  // Email inline edit
  const [editingEmail, setEditingEmail] = useState<number | null>(null);
  const [emailValue,   setEmailValue]   = useState('');

  // Mobile inline edit
  const [editingMobile, setEditingMobile] = useState<number | null>(null);
  const [mobileValue,   setMobileValue]   = useState('');

  // Detail edit (username + org cascade) — SuperAdmin only
  const [editingDetails, setEditingDetails] = useState<number | null>(null);
  const [detailUsername,  setDetailUsername]  = useState('');
  const [detailCountryId, setDetailCountryId] = useState('');
  const [detailRegionId,  setDetailRegionId]  = useState('');
  const [detailDistrictId, setDetailDistrictId] = useState('');
  const [detailOrgId,     setDetailOrgId]     = useState('');
  const [detailError,     setDetailError]     = useState<string | null>(null);

  // Cascade dropdown data for detail edit
  const [ddCountries,  setDdCountries]  = useState<DropdownItem[]>([]);
  const [ddRegions,    setDdRegions]    = useState<DropdownItem[]>([]);
  const [ddDistricts,  setDdDistricts]  = useState<DropdownItem[]>([]);
  const [ddOrgs,       setDdOrgs]       = useState<DropdownItem[]>([]);

  // List filters
  const [filterCountry,  setFilterCountry]  = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [filterSearch,   setFilterSearch]   = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await apiClient.getUsers();
      setUsers(data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Pre-load countries for the detail-edit cascade (SuperAdmin only)
  useEffect(() => {
    if (canEditDetails) {
      (apiClient.getCountries(true) as Promise<{id:number;name:string}[]>)
        .then((c) => setDdCountries(c))
        .catch(() => {});
    }
  }, [canEditDetails]);

  // ── Email save ────────────────────────────────────────────────────────────

  async function saveEmail(user: UserRow) {
    setSaving(user.id);
    try {
      await apiClient.updateUserRole(user.id, { email: emailValue });
      setEditingEmail(null);
      await load();
    } catch {
      alert('Failed to update email address. Please try again.');
    } finally { setSaving(null); }
  }

  // ── Mobile save ───────────────────────────────────────────────────────────

  async function saveMobile(user: UserRow) {
    setSaving(user.id);
    try {
      await apiClient.updateUserRole(user.id, { mobile: mobileValue });
      setEditingMobile(null);
      await load();
    } catch {
      alert('Failed to update mobile number. Please try again.');
    } finally { setSaving(null); }
  }

  // ── Role toggles ──────────────────────────────────────────────────────────

  async function toggle(user: UserRow, field: 'isAdmin' | 'isSysAdmin' | 'isActive') {
    setSaving(user.id);
    try {
      await apiClient.updateUserRole(user.id, { [field]: !user[field] });
      await load();
    } catch {
      alert('Failed to update. Please try again.');
    } finally { setSaving(null); }
  }

  // ── Detail edit cascade ───────────────────────────────────────────────────

  async function openDetailEdit(user: UserRow) {
    setDetailError(null);
    setDetailUsername(user.username ?? '');
    setDetailOrgId(String(user.organisation?.id ?? ''));

    const cid = String(user.organisation?.country?.id  ?? '');
    const rid = String(user.organisation?.province?.id ?? '');
    const did = String(user.organisation?.district?.id ?? '');

    setDetailCountryId(cid);
    setDetailRegionId(rid);
    setDetailDistrictId(did);

    // Pre-populate cascade dropdowns from current org hierarchy
    try {
      const [r, d, o] = await Promise.all([
        cid ? (apiClient.getRegions(Number(cid))                             as Promise<{id:number;name:string}[]>) : Promise.resolve([]),
        rid ? (apiClient.getDistricts(Number(rid))                           as Promise<{id:number;name:string}[]>) : Promise.resolve([]),
        did ? (apiClient.getOrganisations({ districtId: Number(did) })       as Promise<{id:number;name:string}[]>) : Promise.resolve([]),
      ]);
      setDdRegions(r);
      setDdDistricts(d);
      setDdOrgs(o);
    } catch { /* non-fatal */ }

    setEditingDetails(user.id);
  }

  async function onDetailCountryChange(cid: string) {
    setDetailCountryId(cid);
    setDetailRegionId(''); setDetailDistrictId(''); setDetailOrgId('');
    setDdRegions([]); setDdDistricts([]); setDdOrgs([]);
    if (cid) {
      try {
        const r = await apiClient.getRegions(Number(cid)) as {id:number;name:string}[];
        setDdRegions(r);
      } catch { /* non-fatal */ }
    }
  }

  async function onDetailRegionChange(rid: string) {
    setDetailRegionId(rid);
    setDetailDistrictId(''); setDetailOrgId('');
    setDdDistricts([]); setDdOrgs([]);
    if (rid) {
      try {
        const d = await apiClient.getDistricts(Number(rid)) as {id:number;name:string}[];
        setDdDistricts(d);
      } catch { /* non-fatal */ }
    }
  }

  async function onDetailDistrictChange(did: string) {
    setDetailDistrictId(did);
    setDetailOrgId('');
    setDdOrgs([]);
    if (did) {
      try {
        const o = await apiClient.getOrganisations({ districtId: Number(did) }) as {id:number;name:string}[];
        setDdOrgs(o);
      } catch { /* non-fatal */ }
    }
  }

  async function saveDetails(userId: number) {
    setDetailError(null);
    setSaving(userId);
    try {
      await apiClient.updateUserRole(userId, {
        username:       detailUsername.trim()  || null,
        organisationId: detailOrgId ? Number(detailOrgId) : null,
      });
      setEditingDetails(null);
      await load();
    } catch (e: unknown) {
      setDetailError((e as Error).message ?? 'Failed to save. Please try again.');
    } finally { setSaving(null); }
  }

  // ── Reset password ────────────────────────────────────────────────────────

  async function resetPassword(user: UserRow) {
    if (!window.confirm(`Reset password for ${user.firstName ?? user.value} ${user.surname ?? ''}?\n\nTheir password will be reset to the default and they will be required to change it on next login.`)) return;
    setSaving(user.id);
    try {
      await apiClient.resetUserPassword(user.id);
      alert(`Password reset successfully for ${user.firstName ?? user.value} ${user.surname ?? ''}. They will be prompted to change it on next web login.`);
    } catch {
      alert('Failed to reset password. Please try again.');
    } finally { setSaving(null); }
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  const countries = Array.from(new Map(
    users.map((u) => u.organisation?.country).filter(Boolean).map((c) => [c!.id, c!])
  ).values());

  const provinces = Array.from(new Map(
    users.map((u) => u.organisation?.province).filter(Boolean).map((p) => [p!.id, p!])
  ).values()).filter((p) =>
    !filterCountry || users.some((u) => u.organisation?.country?.id === Number(filterCountry) && u.organisation?.province?.id === p.id)
  );

  const filtered = users.filter((u) => {
    if (filterCountry  && u.organisation?.country?.id  !== Number(filterCountry))  return false;
    if (filterProvince && u.organisation?.province?.id !== Number(filterProvince)) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const name = [u.firstName, u.surname].filter(Boolean).join(' ').toLowerCase();
      if (!name.includes(q) && !(u.email ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // How many columns total (for colSpan in detail row)
  const colCount =
    1 + // First Name
    1 + // Surname
    (canSeeUsername ? 1 : 0) +
    1 + // Email
    1 + // Mobile
    (canSeeOrgCols ? 1 : 0) + // Organisation
    (canSeeOrgCols ? 1 : 0) + // Country
    (canSeeOrgCols ? 1 : 0) + // Region
    (canSeeOrgCols ? 1 : 0) + // District
    1 + // Active
    1 + // Admin
    1 + // SysAdmin
    (canEditDetails ? 1 : 0) + // Edit Details
    (canResetPassword ? 1 : 0); // Reset Password

  return (
    <div>
      <div style={toolbar}>
        <div>
          <h2 style={pageTitle}>User Management</h2>
          <p style={subtitle}>Manage responder roles and access. SysAdmin only.</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={filterRow}>
        {canSeeOrgCols && (
          <>
            <select style={filterSelect} value={filterCountry} onChange={(e) => { setFilterCountry(e.target.value); setFilterProvince(''); }}>
              <option value="">All Countries</option>
              {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select style={filterSelect} value={filterProvince} onChange={(e) => setFilterProvince(e.target.value)} disabled={!filterCountry}>
              <option value="">All Regions</option>
              {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>
        )}
        <input
          style={{ ...filterSelect, flex: 1, minWidth: 160 }}
          placeholder="Search name or email…"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
        />
        {(filterCountry || filterProvince || filterSearch) && (
          <button style={clearBtn} onClick={() => { setFilterCountry(''); setFilterProvince(''); setFilterSearch(''); }}>
            Clear
          </button>
        )}
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 48 }}>Loading...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr style={thead}>
                <th style={th}>First Name</th>
                <th style={th}>Surname</th>
                {canSeeUsername && <th style={th}>Username</th>}
                <th style={th}>Email</th>
                <th style={th}>Mobile</th>
                {canSeeOrgCols && <th style={th}>Organisation</th>}
                {canSeeOrgCols && <th style={th}>Country</th>}
                {canSeeOrgCols && <th style={th}>Region</th>}
                {canSeeOrgCols && <th style={th}>District</th>}
                <th style={{ ...th, textAlign: 'center' }}>Active</th>
                <th style={{ ...th, textAlign: 'center' }}>Admin</th>
                <th style={{ ...th, textAlign: 'center' }}>SysAdmin</th>
                {canEditDetails    && <th style={{ ...th, width: 80 }} />}
                {canResetPassword  && <th style={{ ...th, width: 100, textAlign: 'center' }}>Password</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <React.Fragment key={user.id}>
                  {/* ── Main row ── */}
                  <tr style={tr}>
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>{user.firstName ?? user.value}</span>
                      {user.isSysAdmin && <span style={sysAdminTag}>SYSADMIN</span>}
                      {user.isAdmin && !user.isSysAdmin && <span style={adminTag}>ADMIN</span>}
                    </td>
                    <td style={td}>{user.surname ?? '—'}</td>
                    {canSeeUsername && (
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 13, color: '#374151' }}>
                        {user.username ?? '—'}
                      </td>
                    )}
                    {/* Email — inline edit */}
                    <td style={{ ...td, color: '#6b7280', fontSize: 13 }}>
                      {editingEmail === user.id ? (
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            autoFocus
                            style={{ border: '1.5px solid #dc2626', borderRadius: 6, padding: '3px 8px', fontSize: 13, width: 170 }}
                            value={emailValue}
                            onChange={(e) => setEmailValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEmail(user); if (e.key === 'Escape') setEditingEmail(null); }}
                            placeholder="email@example.com"
                            type="email"
                          />
                          <button onClick={() => saveEmail(user)} disabled={saving === user.id}
                            style={{ fontSize: 12, padding: '3px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                            Save
                          </button>
                          <button onClick={() => setEditingEmail(null)}
                            style={{ fontSize: 12, padding: '3px 8px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}>
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span
                          title="Click to edit email"
                          style={{ cursor: 'pointer', borderBottom: '1px dashed #d1d5db' }}
                          onClick={() => { setEditingEmail(user.id); setEmailValue(user.email ?? ''); }}
                        >
                          {user.email ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* Mobile — inline edit */}
                    <td style={{ ...td, color: '#6b7280', fontSize: 13 }}>
                      {editingMobile === user.id ? (
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            autoFocus
                            style={{ border: '1.5px solid #dc2626', borderRadius: 6, padding: '3px 8px', fontSize: 13, width: 130 }}
                            value={mobileValue}
                            onChange={(e) => setMobileValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveMobile(user); if (e.key === 'Escape') setEditingMobile(null); }}
                            placeholder="+27821234567"
                          />
                          <button onClick={() => saveMobile(user)} disabled={saving === user.id}
                            style={{ fontSize: 12, padding: '3px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                            Save
                          </button>
                          <button onClick={() => setEditingMobile(null)}
                            style={{ fontSize: 12, padding: '3px 8px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer' }}>
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span
                          title="Click to edit mobile"
                          style={{ cursor: 'pointer', borderBottom: '1px dashed #d1d5db' }}
                          onClick={() => { setEditingMobile(user.id); setMobileValue(user.mobile ?? ''); }}
                        >
                          {user.mobile ?? '—'}
                        </span>
                      )}
                    </td>

                    {canSeeOrgCols && <td style={{ ...td, fontSize: 13 }}>{user.organisation?.name ?? '—'}</td>}
                    {canSeeOrgCols && <td style={{ ...td, fontSize: 13 }}>{user.organisation?.country?.name ?? '—'}</td>}
                    {canSeeOrgCols && <td style={{ ...td, fontSize: 13 }}>{user.organisation?.province?.name ?? '—'}</td>}
                    {canSeeOrgCols && <td style={{ ...td, fontSize: 13 }}>{user.organisation?.district?.name ?? '—'}</td>}

                    <td style={{ ...td, textAlign: 'center' }}>
                      <ToggleBtn value={user.isActive}   disabled={saving === user.id} onToggle={() => toggle(user, 'isActive')}   colorOn="#16a34a" />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <ToggleBtn value={user.isAdmin}    disabled={saving === user.id} onToggle={() => toggle(user, 'isAdmin')}    colorOn="#dc2626" />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <ToggleBtn value={user.isSysAdmin} disabled={saving === user.id} onToggle={() => toggle(user, 'isSysAdmin')} colorOn="#7c3aed" />
                    </td>
                    {canEditDetails && (
                      <td style={{ ...td, textAlign: 'center' }}>
                        <button
                          style={editBtn}
                          onClick={() => editingDetails === user.id ? setEditingDetails(null) : openDetailEdit(user)}
                        >
                          {editingDetails === user.id ? 'Close' : 'Edit'}
                        </button>
                      </td>
                    )}
                    {canResetPassword && (
                      <td style={{ ...td, textAlign: 'center' }}>
                        <button
                          style={resetPwdBtn}
                          disabled={saving === user.id}
                          onClick={() => resetPassword(user)}
                          title="Reset to default password — user must change on next login"
                        >
                          Reset Pwd
                        </button>
                      </td>
                    )}
                  </tr>

                  {/* ── Detail edit expansion row ── */}
                  {canEditDetails && editingDetails === user.id && (
                    <tr style={{ backgroundColor: '#fef9f9' }}>
                      <td colSpan={colCount} style={{ padding: '16px 20px', borderBottom: '2px solid #fecaca' }}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>

                          {/* Username */}
                          <label style={detailLabel}>
                            Username
                            <input
                              style={detailInp}
                              value={detailUsername}
                              onChange={(e) => setDetailUsername(e.target.value)}
                              placeholder="username"
                              autoComplete="off"
                            />
                          </label>

                          {/* Country */}
                          <label style={detailLabel}>
                            Country
                            <select style={detailInp} value={detailCountryId} onChange={(e) => onDetailCountryChange(e.target.value)}>
                              <option value="">— Select —</option>
                              {ddCountries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </label>

                          {/* Region */}
                          <label style={detailLabel}>
                            Region
                            <select style={detailInp} value={detailRegionId} onChange={(e) => onDetailRegionChange(e.target.value)} disabled={!detailCountryId}>
                              <option value="">— Select —</option>
                              {ddRegions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                          </label>

                          {/* District */}
                          <label style={detailLabel}>
                            District
                            <select style={detailInp} value={detailDistrictId} onChange={(e) => onDetailDistrictChange(e.target.value)} disabled={!detailRegionId}>
                              <option value="">— Select —</option>
                              {ddDistricts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </label>

                          {/* Organisation */}
                          <label style={detailLabel}>
                            Organisation
                            <select style={detailInp} value={detailOrgId} onChange={(e) => setDetailOrgId(e.target.value)} disabled={!detailDistrictId}>
                              <option value="">— Select —</option>
                              {ddOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          </label>

                          {/* Buttons */}
                          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end', paddingBottom: 1 }}>
                            <button
                              style={saveDetailBtn}
                              onClick={() => saveDetails(user.id)}
                              disabled={saving === user.id}
                            >
                              {saving === user.id ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              style={cancelDetailBtn}
                              onClick={() => { setEditingDetails(null); setDetailError(null); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>

                        {detailError && (
                          <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13 }}>
                            ⚠ {detailError}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ToggleBtn({ value, disabled, onToggle, colorOn }: {
  value: boolean; disabled: boolean; onToggle: () => void; colorOn: string;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        width: 48, height: 26, borderRadius: 13, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: value ? colorOn : '#d1d5db', position: 'relative', transition: 'background 0.2s', opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 25 : 3, width: 20, height: 20,
        borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

const toolbar: React.CSSProperties        = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 };
const pageTitle: React.CSSProperties      = { fontSize: 24, fontWeight: 700 };
const subtitle: React.CSSProperties       = { color: '#6b7280', fontSize: 14 };
const filterRow: React.CSSProperties      = { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' };
const filterSelect: React.CSSProperties   = { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '7px 12px', fontSize: 14 };
const clearBtn: React.CSSProperties       = { border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 14px', fontSize: 13, background: '#f3f4f6', cursor: 'pointer' };
const table: React.CSSProperties          = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const thead: React.CSSProperties          = { backgroundColor: '#f3f4f6' };
const th: React.CSSProperties             = { padding: '12px 14px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' };
const tr: React.CSSProperties             = { borderBottom: '1px solid #f3f4f6' };
const td: React.CSSProperties             = { padding: '12px 14px', fontSize: 14, color: '#111827', verticalAlign: 'middle' };
const adminTag: React.CSSProperties       = { marginLeft: 8, fontSize: 11, fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '2px 6px' };
const sysAdminTag: React.CSSProperties    = { marginLeft: 8, fontSize: 11, fontWeight: 700, backgroundColor: '#f5f3ff', color: '#7c3aed', borderRadius: 4, padding: '2px 6px' };
const editBtn: React.CSSProperties        = { padding: '4px 12px', fontSize: 12, fontWeight: 600, border: '1.5px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151' };
const detailLabel: React.CSSProperties    = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#6b7280' };
const detailInp: React.CSSProperties      = { padding: '7px 10px', borderRadius: 7, border: '1.5px solid #d1d5db', fontSize: 13, minWidth: 160 };
const saveDetailBtn: React.CSSProperties  = { padding: '8px 18px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const cancelDetailBtn: React.CSSProperties = { padding: '8px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' };
const resetPwdBtn: React.CSSProperties    = { padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1.5px solid #f97316', borderRadius: 6, background: '#fff7ed', cursor: 'pointer', color: '#c2410c' };
