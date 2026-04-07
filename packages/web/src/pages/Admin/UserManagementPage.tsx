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
  } | null;
}

export function UserManagementPage() {
  const { auth } = useAuth();
  const canSeeUsername = auth?.role === 'SUPER_ADMIN' || auth?.role === 'COUNTRY_SYSADMIN';
  const canSeeOrgCols  = auth?.role === 'SUPER_ADMIN' || auth?.role === 'COUNTRY_SYSADMIN';

  const [users, setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError]   = useState<string | null>(null);

  // Filters (SUPER_ADMIN / COUNTRY_SYSADMIN only)
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

  async function toggle(user: UserRow, field: 'isAdmin' | 'isSysAdmin' | 'isActive') {
    setSaving(user.id);
    try {
      await apiClient.updateUserRole(user.id, { [field]: !user[field] });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, [field]: !user[field] } : u));
    } catch {
      alert('Failed to update user role. Please try again.');
    } finally {
      setSaving(null);
    }
  }

  // Derive filter options from loaded data
  const countries  = Array.from(new Map(users.map((u) => u.organisation?.country).filter(Boolean).map((c) => [c!.id, c!])).values());
  const provinces  = Array.from(new Map(users.map((u) => u.organisation?.province).filter(Boolean).map((p) => [p!.id, p!])).values())
    .filter((p) => !filterCountry || users.some((u) => u.organisation?.country?.id === Number(filterCountry) && u.organisation?.province?.id === p.id));

  // Apply filters
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
              <option value="">All Provinces</option>
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
              {canSeeOrgCols && <th style={th}>Province</th>}
              <th style={{ ...th, textAlign: 'center' }}>Active</th>
              <th style={{ ...th, textAlign: 'center' }}>Admin</th>
              <th style={{ ...th, textAlign: 'center' }}>SysAdmin</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} style={tr}>
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
                <td style={{ ...td, color: '#6b7280', fontSize: 13 }}>{user.email ?? '—'}</td>
                <td style={{ ...td, color: '#6b7280', fontSize: 13 }}>{user.mobile ?? '—'}</td>
                {canSeeOrgCols && <td style={{ ...td, fontSize: 13 }}>{user.organisation?.name ?? '—'}</td>}
                {canSeeOrgCols && <td style={{ ...td, fontSize: 13 }}>{user.organisation?.country?.name ?? '—'}</td>}
                {canSeeOrgCols && <td style={{ ...td, fontSize: 13 }}>{user.organisation?.province?.name ?? '—'}</td>}
                <td style={{ ...td, textAlign: 'center' }}>
                  <ToggleBtn value={user.isActive}  disabled={saving === user.id} onToggle={() => toggle(user, 'isActive')}  colorOn="#16a34a" />
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <ToggleBtn value={user.isAdmin}   disabled={saving === user.id} onToggle={() => toggle(user, 'isAdmin')}   colorOn="#dc2626" />
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <ToggleBtn value={user.isSysAdmin} disabled={saving === user.id} onToggle={() => toggle(user, 'isSysAdmin')} colorOn="#7c3aed" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

const toolbar: React.CSSProperties       = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 };
const pageTitle: React.CSSProperties     = { fontSize: 24, fontWeight: 700 };
const subtitle: React.CSSProperties      = { color: '#6b7280', fontSize: 14 };
const filterRow: React.CSSProperties     = { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' };
const filterSelect: React.CSSProperties  = { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '7px 12px', fontSize: 14 };
const clearBtn: React.CSSProperties      = { border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 14px', fontSize: 13, background: '#f3f4f6', cursor: 'pointer' };
const table: React.CSSProperties         = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const thead: React.CSSProperties         = { backgroundColor: '#f3f4f6' };
const th: React.CSSProperties            = { padding: '12px 14px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' };
const tr: React.CSSProperties            = { borderBottom: '1px solid #f3f4f6' };
const td: React.CSSProperties            = { padding: '12px 14px', fontSize: 14, color: '#111827', verticalAlign: 'middle' };
const adminTag: React.CSSProperties      = { marginLeft: 8, fontSize: 11, fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '2px 6px' };
const sysAdminTag: React.CSSProperties   = { marginLeft: 8, fontSize: 11, fontWeight: 700, backgroundColor: '#f5f3ff', color: '#7c3aed', borderRadius: 4, padding: '2px 6px' };
