/**
 * SuperAdmin — Geographic hierarchy management
 * Countries → Provinces → Districts
 */
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';

interface Country  { id: number; name: string; isoCode: string; isActive: boolean; _count?: { organisations: number } }
interface Province { id: number; name: string; countryId: number; isActive: boolean; country?: { name: string } }
interface District { id: number; name: string; provinceId: number; isActive: boolean; province?: { name: string; country?: { name: string } } }

type Tab = 'countries' | 'provinces' | 'districts';

export function HierarchyPage() {
  const [tab, setTab]             = useState<Tab>('countries');
  const [countries, setCountries] = useState<Country[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading]     = useState(false);

  // Add form state
  const [addMode, setAddMode] = useState(false);
  const [form, setForm]       = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [editId, setEditId]   = useState<number | null>(null);

  useEffect(() => { load(); }, [tab]);

  async function load() {
    setLoading(true);
    try {
      if (tab === 'countries')  setCountries(await apiClient.getCountries(true) as Country[]);
      if (tab === 'provinces')  setProvinces(await apiClient.getProvinces() as Province[]);
      if (tab === 'districts')  setDistricts(await apiClient.getDistricts() as District[]);
    } finally { setLoading(false); }
  }

  async function handleAdd() {
    setSaving(true);
    try {
      if (tab === 'countries')  await apiClient.createCountry(form);
      if (tab === 'provinces')  await apiClient.createProvince({ ...form, countryId: Number(form.countryId) });
      if (tab === 'districts')  await apiClient.createDistrict({ ...form, provinceId: Number(form.provinceId) });
      setAddMode(false); setForm({});
      load();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggle(id: number, isActive: boolean) {
    try {
      if (tab === 'countries')  await apiClient.updateCountry(id, { isActive: !isActive });
      if (tab === 'provinces')  await apiClient.updateProvince(id, { isActive: !isActive });
      if (tab === 'districts')  await apiClient.updateDistrict(id, { isActive: !isActive });
      load();
    } catch (e: unknown) { alert((e as Error).message); }
  }

  async function handleEdit(id: number) {
    setSaving(true);
    try {
      if (tab === 'countries')  await apiClient.updateCountry(id, form);
      if (tab === 'provinces')  await apiClient.updateProvince(id, form);
      if (tab === 'districts')  await apiClient.updateDistrict(id, form);
      setEditId(null); setForm({});
      load();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  const rows = tab === 'countries' ? countries : tab === 'provinces' ? provinces : districts;

  return (
    <div>
      <div style={toolbar}>
        <div>
          <h2 style={pageTitle}>Geographic Hierarchy</h2>
          <p style={subtitle}>Manage countries, provinces and districts. SuperAdmin only.</p>
        </div>
        <button style={addBtn} onClick={() => { setAddMode(true); setForm({}); }}>+ Add</button>
      </div>

      {/* Tab switcher */}
      <div style={tabs}>
        {(['countries', 'provinces', 'districts'] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setAddMode(false); setEditId(null); }} style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Add form */}
      {addMode && (
        <div style={formBox}>
          {tab === 'countries' && (
            <>
              <input placeholder="Country name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
              <input placeholder="ISO code (e.g. ZAF)" value={form.isoCode ?? ''} onChange={(e) => setForm({ ...form, isoCode: e.target.value })} style={inp} maxLength={3} />
            </>
          )}
          {tab === 'provinces' && (
            <>
              <input placeholder="Province name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
              <select value={form.countryId ?? ''} onChange={(e) => setForm({ ...form, countryId: e.target.value })} style={inp}>
                <option value="">— Select country —</option>
                {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          )}
          {tab === 'districts' && (
            <>
              <input placeholder="District name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
              <select value={form.provinceId ?? ''} onChange={(e) => setForm({ ...form, provinceId: e.target.value })} style={inp}>
                <option value="">— Select province —</option>
                {provinces.map((p) => <option key={p.id} value={p.id}>{p.country?.name} › {p.name}</option>)}
              </select>
            </>
          )}
          <button style={saveBtn} onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
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
              {tab === 'countries'  && <th style={th}>ISO</th>}
              {tab === 'provinces'  && <th style={th}>Country</th>}
              {tab === 'districts'  && <th style={th}>Province</th>}
              <th style={{ ...th, textAlign: 'center' }}>Active</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: Country & Province & District) => (
              <tr key={row.id} style={tr}>
                <td style={td}>
                  {editId === row.id ? (
                    <input value={form.name ?? row.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inp, width: 200 }} />
                  ) : (
                    <span style={{ fontWeight: 600 }}>{row.name}</span>
                  )}
                </td>
                {tab === 'countries'  && <td style={td}><span style={pill}>{row.isoCode}</span></td>}
                {tab === 'provinces'  && <td style={td}>{row.country?.name}</td>}
                {tab === 'districts'  && <td style={td}>{row.province?.country?.name} › {row.province?.name}</td>}
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ ...statusDot, backgroundColor: row.isActive ? '#16a34a' : '#d1d5db' }} />
                </td>
                <td style={{ ...td, textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {editId === row.id ? (
                    <>
                      <button style={saveBtn} onClick={() => handleEdit(row.id)} disabled={saving}>Save</button>
                      <button style={cancelBtn} onClick={() => setEditId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button style={editBtn} onClick={() => { setEditId(row.id); setForm({ name: row.name }); }}>Edit</button>
                      <button style={{ ...editBtn, color: row.isActive ? '#dc2626' : '#16a34a' }} onClick={() => handleToggle(row.id, row.isActive)}>
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const toolbar: React.CSSProperties    = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 };
const pageTitle: React.CSSProperties  = { fontSize: 24, fontWeight: 700 };
const subtitle: React.CSSProperties   = { color: '#6b7280', fontSize: 14 };
const tabs: React.CSSProperties       = { display: 'flex', gap: 8, marginBottom: 16 };
const tabBtn: React.CSSProperties     = { padding: '8px 18px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 };
const tabActive: React.CSSProperties  = { backgroundColor: '#dc2626', color: '#fff', borderColor: '#dc2626' };
const formBox: React.CSSProperties    = { display: 'flex', gap: 10, alignItems: 'center', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16, flexWrap: 'wrap' };
const inp: React.CSSProperties        = { padding: '8px 10px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14, minWidth: 180 };
const table: React.CSSProperties      = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const thead: React.CSSProperties      = { backgroundColor: '#f3f4f6' };
const th: React.CSSProperties         = { padding: '11px 14px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' };
const tr: React.CSSProperties         = { borderBottom: '1px solid #f3f4f6' };
const td: React.CSSProperties         = { padding: '11px 14px', fontSize: 14, color: '#111827', verticalAlign: 'middle' };
const pill: React.CSSProperties       = { fontSize: 12, fontWeight: 700, backgroundColor: '#f3f4f6', borderRadius: 6, padding: '2px 8px' };
const statusDot: React.CSSProperties  = { display: 'inline-block', width: 10, height: 10, borderRadius: 5 };
const addBtn: React.CSSProperties     = { padding: '9px 18px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const saveBtn: React.CSSProperties    = { padding: '7px 14px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const cancelBtn: React.CSSProperties  = { padding: '7px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' };
const editBtn: React.CSSProperties    = { padding: '5px 12px', backgroundColor: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151' };
