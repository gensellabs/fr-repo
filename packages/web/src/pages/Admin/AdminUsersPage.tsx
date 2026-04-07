/**
 * SuperAdmin — Admin user management (SuperAdmin + CountrySysAdmin accounts)
 */
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';

interface AdminUser {
  id: number; name: string; email: string; mobile?: string;
  role: string; countryId?: number; isActive: boolean;
  createdAt: string; lastLoginAt?: string;
  country?: { name: string };
}

interface SelectItem { id: number; name: string }

export function AdminUsersPage() {
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [countries, setCountries] = useState<SelectItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [addMode, setAddMode]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState<Record<string, string>>({ role: 'COUNTRY_SYSADMIN' });
  const [editId, setEditId]     = useState<number | null>(null);

  useEffect(() => {
    load();
    apiClient.getCountries().then((d) => setCountries(d as SelectItem[]));
  }, []);

  async function load() {
    setLoading(true);
    try { setUsers(await apiClient.getAdminUsers() as AdminUser[]); }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!form.name || !form.email || !form.password) {
      alert('Name, email and password are required');
      return;
    }
    setSaving(true);
    try {
      await apiClient.createAdminUser({ ...form, countryId: form.countryId ? Number(form.countryId) : undefined });
      setAddMode(false); setForm({ role: 'COUNTRY_SYSADMIN' });
      load();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggle(id: number, isActive: boolean) {
    try {
      await apiClient.updateAdminUser(id, { isActive: !isActive });
      load();
    } catch (e: unknown) { alert((e as Error).message); }
  }

  const roleColour: Record<string, string> = {
    SUPER_ADMIN: '#7c3aed',
    COUNTRY_SYSADMIN: '#dc2626',
  };

  return (
    <div>
      <div style={toolbar}>
        <div>
          <h2 style={pageTitle}>Admin Users</h2>
          <p style={subtitle}>Manage SuperAdmin and CountrySysAdmin accounts. SuperAdmin only.</p>
        </div>
        <button style={addBtn} onClick={() => { setAddMode(true); setForm({ role: 'COUNTRY_SYSADMIN' }); }}>+ Add Admin User</button>
      </div>

      {addMode && (
        <div style={formBox}>
          <input placeholder="Full name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
          <input type="email" placeholder="Email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inp} />
          <input type="tel" placeholder="Mobile (optional)" value={form.mobile ?? ''} onChange={(e) => setForm({ ...form, mobile: e.target.value })} style={inp} />
          <input type="password" placeholder="Password" value={form.password ?? ''} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inp} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inp}>
            <option value="COUNTRY_SYSADMIN">Country SysAdmin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
          {form.role === 'COUNTRY_SYSADMIN' && (
            <select value={form.countryId ?? ''} onChange={(e) => setForm({ ...form, countryId: e.target.value })} style={inp}>
              <option value="">— Select country —</option>
              {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button style={saveBtn} onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
          <button style={cancelBtn} onClick={() => setAddMode(false)}>Cancel</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 40 }}>Loading…</p>
      ) : (
        <table style={table}>
          <thead>
            <tr style={thead}>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Mobile</th>
              <th style={th}>Role</th>
              <th style={th}>Country</th>
              <th style={{ ...th, textAlign: 'center' }}>Active</th>
              <th style={th}>Last Login</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={tr}>
                <td style={td}><span style={{ fontWeight: 600 }}>{u.name}</span></td>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.mobile ?? '—'}</td>
                <td style={td}>
                  <span style={{ ...rolePill, backgroundColor: `${roleColour[u.role] ?? '#6b7280'}22`, color: roleColour[u.role] ?? '#6b7280' }}>
                    {u.role.replace('_', ' ')}
                  </span>
                </td>
                <td style={td}>{u.country?.name ?? '—'}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ ...statusDot, backgroundColor: u.isActive ? '#16a34a' : '#d1d5db' }} />
                </td>
                <td style={td}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-ZA') : 'Never'}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button style={{ ...editBtn, color: u.isActive ? '#dc2626' : '#16a34a' }} onClick={() => handleToggle(u.id, u.isActive)}>
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const toolbar: React.CSSProperties   = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 };
const pageTitle: React.CSSProperties = { fontSize: 24, fontWeight: 700 };
const subtitle: React.CSSProperties  = { color: '#6b7280', fontSize: 14 };
const formBox: React.CSSProperties   = { display: 'flex', gap: 10, alignItems: 'center', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16, flexWrap: 'wrap' };
const inp: React.CSSProperties       = { padding: '8px 10px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14, minWidth: 160 };
const table: React.CSSProperties     = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const thead: React.CSSProperties     = { backgroundColor: '#f3f4f6' };
const th: React.CSSProperties        = { padding: '11px 14px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' };
const tr: React.CSSProperties        = { borderBottom: '1px solid #f3f4f6' };
const td: React.CSSProperties        = { padding: '11px 14px', fontSize: 14, color: '#111827', verticalAlign: 'middle' };
const addBtn: React.CSSProperties    = { padding: '9px 18px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const saveBtn: React.CSSProperties   = { padding: '7px 14px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const cancelBtn: React.CSSProperties = { padding: '7px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' };
const editBtn: React.CSSProperties   = { padding: '5px 12px', backgroundColor: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151' };
const statusDot: React.CSSProperties = { display: 'inline-block', width: 10, height: 10, borderRadius: 5 };
const rolePill: React.CSSProperties  = { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 10px' };
