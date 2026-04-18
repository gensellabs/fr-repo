/**
 * CountrySysAdmin+ — Geographic hierarchy management
 * Countries (SuperAdmin only) → Provinces → Districts → Areas
 */
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

interface Country  { id: number; name: string; isoCode: string; isActive: boolean; _count?: { organisations: number } }
interface Province { id: number; name: string; countryId: number; isActive: boolean; country?: { name: string } }
interface District { id: number; name: string; provinceId: number; isActive: boolean; province?: { name: string; country?: { name: string } } }
interface AreaRow  { id: number; value: string; districtId?: number; isActive: boolean; district?: { name: string; province?: { name: string; country?: { name: string } } } }

type Tab = 'countries' | 'provinces' | 'districts' | 'areas';

export function HierarchyPage() {
  const { auth } = useAuth();
  const isSuperAdmin      = auth?.role === 'SUPER_ADMIN';
  const isCountryAdmin    = auth?.role === 'COUNTRY_SYSADMIN';

  // CountryAdmin starts on provinces tab (no countries tab for them)
  const [tab, setTab]             = useState<Tab>(isSuperAdmin ? 'countries' : 'provinces');
  const [countries, setCountries] = useState<Country[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [areas,     setAreas]     = useState<AreaRow[]>([]);
  const [loading, setLoading]     = useState(false);

  // Add form state
  const [addMode, setAddMode] = useState(false);
  const [form, setForm]       = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [editId, setEditId]   = useState<number | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // For cascading dropdowns in add forms (SuperAdmin needs all; CountryAdmin pre-scoped)
  const [allProvinces, setAllProvinces] = useState<Province[]>([]);
  const [allDistricts, setAllDistricts] = useState<District[]>([]);

  useEffect(() => {
    // Pre-load provinces + districts for dropdown use
    const countryId = isCountryAdmin ? auth?.countryId : undefined;
    apiClient.getProvinces(countryId).then((d) => setAllProvinces(d as Province[]));
    apiClient.getDistricts(undefined, countryId).then((d) => setAllDistricts(d as District[]));
    if (isSuperAdmin) apiClient.getCountries(true).then((d) => setCountries(d as Country[]));
  }, []);

  useEffect(() => { load(); }, [tab]);

  async function load() {
    setLoading(true);
    try {
      const countryId = isCountryAdmin ? auth?.countryId : undefined;
      if (tab === 'countries')  setCountries(await apiClient.getCountries(true) as Country[]);
      if (tab === 'provinces')  setProvinces(await apiClient.getProvinces(countryId) as Province[]);
      if (tab === 'districts')  setDistricts(await apiClient.getDistricts(undefined, countryId) as District[]);
      if (tab === 'areas')      setAreas(await apiClient.getHierarchyAreas(undefined, countryId) as AreaRow[]);
    } finally { setLoading(false); }
  }

  async function handleAdd() {
    setError(null);
    setSaving(true);
    try {
      if (tab === 'countries') {
        await apiClient.createCountry(form);
      }
      if (tab === 'provinces') {
        const countryId = isCountryAdmin ? String(auth?.countryId) : form.countryId;
        if (!form.name?.trim()) { setError('Province name is required.'); return; }
        if (!countryId) { setError('Please select a country.'); return; }
        await apiClient.createProvince({ name: form.name.trim(), countryId: Number(countryId) });
      }
      if (tab === 'districts') {
        if (!form.name?.trim()) { setError('District name is required.'); return; }
        if (!form.provinceId) { setError('Please select a province.'); return; }
        await apiClient.createDistrict({ name: form.name.trim(), provinceId: Number(form.provinceId) });
      }
      if (tab === 'areas') {
        if (!form.value?.trim()) { setError('Area name is required.'); return; }
        if (!form.districtId) { setError('Please select a district.'); return; }
        await apiClient.createHierarchyArea({ value: form.value.trim(), districtId: Number(form.districtId) });
      }
      setAddMode(false); setForm({});
      load();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggle(id: number, isActive: boolean) {
    setError(null);
    try {
      if (tab === 'countries')  await apiClient.updateCountry(id, { isActive: !isActive });
      if (tab === 'provinces')  await apiClient.updateProvince(id, { isActive: !isActive });
      if (tab === 'districts')  await apiClient.updateDistrict(id, { isActive: !isActive });
      if (tab === 'areas')      await apiClient.updateHierarchyArea(id, { isActive: !isActive });
      load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleEdit(id: number) {
    setError(null);
    setSaving(true);
    try {
      if (tab === 'countries')  await apiClient.updateCountry(id, form);
      if (tab === 'provinces')  await apiClient.updateProvince(id, form);
      if (tab === 'districts')  await apiClient.updateDistrict(id, form);
      if (tab === 'areas')      await apiClient.updateHierarchyArea(id, { value: form.value });
      setEditId(null); setForm({});
      load();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  // Visible tabs depend on role
  const visibleTabs: Tab[] = isSuperAdmin
    ? ['countries', 'provinces', 'districts', 'areas']
    : ['provinces', 'districts', 'areas'];

  const tabLabels: Record<Tab, string> = {
    countries: 'Countries',
    provinces: 'Provinces / Regions',
    districts: 'Districts',
    areas:     'Areas',
  };

  const rows = tab === 'countries' ? countries
    : tab === 'provinces' ? provinces
    : tab === 'districts' ? districts
    : areas;

  return (
    <div>
      <div style={toolbar}>
        <div>
          <h2 style={pageTitle}>Geographic Hierarchy</h2>
          <p style={subtitle}>
            {isSuperAdmin
              ? 'Manage countries, provinces, districts and areas.'
              : 'Manage provinces, districts and areas within your country.'}
          </p>
        </div>
        {tab !== 'countries' || isSuperAdmin ? (
          <button style={addBtn} onClick={() => { setAddMode(true); setForm({}); setError(null); }}>+ Add</button>
        ) : null}
      </div>

      {/* Tab switcher */}
      <div style={tabs}>
        {visibleTabs.map((t) => (
          <button key={t} onClick={() => { setTab(t); setAddMode(false); setEditId(null); setError(null); }}
            style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Add form */}
      {addMode && (
        <div style={formBox}>
          {tab === 'countries' && (
            <>
              <input placeholder="Country name *" value={form.name ?? ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
              <input placeholder="ISO code (e.g. ZAF)" value={form.isoCode ?? ''}
                onChange={(e) => setForm({ ...form, isoCode: e.target.value })} style={{ ...inp, maxWidth: 120 }} maxLength={3} />
            </>
          )}
          {tab === 'provinces' && (
            <>
              <input placeholder="Province / Region name *" value={form.name ?? ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
              {isSuperAdmin ? (
                <select value={form.countryId ?? ''} onChange={(e) => setForm({ ...form, countryId: e.target.value })} style={inp}>
                  <option value="">— Select country *—</option>
                  {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <span style={countryBadge}>{auth?.countryName ?? 'Your country'}</span>
              )}
            </>
          )}
          {tab === 'districts' && (
            <>
              <input placeholder="District name *" value={form.name ?? ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
              <select value={form.provinceId ?? ''} onChange={(e) => setForm({ ...form, provinceId: e.target.value })} style={inp}>
                <option value="">— Select province *—</option>
                {allProvinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {!isCountryAdmin && p.country?.name ? `${p.country.name} › ` : ''}{p.name}
                  </option>
                ))}
              </select>
            </>
          )}
          {tab === 'areas' && (
            <>
              <input placeholder="Area / Town name *" value={form.value ?? ''}
                onChange={(e) => setForm({ ...form, value: e.target.value })} style={inp} />
              <select value={form.districtId ?? ''} onChange={(e) => setForm({ ...form, districtId: e.target.value })} style={inp}>
                <option value="">— Select district *—</option>
                {allDistricts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {!isCountryAdmin && d.province?.country?.name ? `${d.province.country.name} › ` : ''}
                    {d.province?.name} › {d.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <button style={saveBtn} onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button style={cancelBtn} onClick={() => { setAddMode(false); setError(null); }}>Cancel</button>
          {error && <div style={errBanner}>⚠ {error}</div>}
        </div>
      )}

      {!addMode && error && <div style={{ ...errBanner, marginBottom: 12 }}>⚠ {error}</div>}

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
              {tab === 'areas'      && <th style={th}>District › Province</th>}
              <th style={{ ...th, textAlign: 'center' }}>Active</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows as (Country & Province & District & AreaRow)[]).map((row) => (
              <tr key={row.id} style={tr}>
                <td style={td}>
                  {editId === row.id ? (
                    <input
                      value={form[tab === 'areas' ? 'value' : 'name'] ?? (tab === 'areas' ? row.value : row.name)}
                      onChange={(e) => setForm({ ...form, [tab === 'areas' ? 'value' : 'name']: e.target.value })}
                      style={{ ...inp, width: 200 }}
                    />
                  ) : (
                    <span style={{ fontWeight: 600 }}>{tab === 'areas' ? row.value : row.name}</span>
                  )}
                </td>
                {tab === 'countries'  && <td style={td}><span style={pill}>{row.isoCode}</span></td>}
                {tab === 'provinces'  && <td style={td}>{row.country?.name}</td>}
                {tab === 'districts'  && <td style={td}>{row.province?.country?.name} › {row.province?.name}</td>}
                {tab === 'areas'      && <td style={td}>{row.district?.province?.name} › {row.district?.name}</td>}
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ ...statusDot, backgroundColor: row.isActive ? '#16a34a' : '#d1d5db' }} />
                </td>
                <td style={{ ...td, textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {editId === row.id ? (
                    <>
                      <button style={saveBtn} onClick={() => handleEdit(row.id)} disabled={saving}>Save</button>
                      <button style={cancelBtn} onClick={() => { setEditId(null); setError(null); }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      {/* Countries can only be edited by SuperAdmin */}
                      {(tab !== 'countries' || isSuperAdmin) && (
                        <button style={editBtn} onClick={() => {
                          setEditId(row.id);
                          setForm(tab === 'areas' ? { value: row.value } : { name: row.name });
                        }}>Edit</button>
                      )}
                      <button
                        style={{ ...editBtn, color: row.isActive ? '#dc2626' : '#16a34a' }}
                        onClick={() => handleToggle(row.id, row.isActive)}
                      >
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>
                  No {tabLabels[tab].toLowerCase()} found.
                  {tab !== 'countries' && ' Use the + Add button to create one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const toolbar: React.CSSProperties      = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 };
const pageTitle: React.CSSProperties    = { fontSize: 24, fontWeight: 700 };
const subtitle: React.CSSProperties     = { color: '#6b7280', fontSize: 14 };
const tabs: React.CSSProperties         = { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' };
const tabBtn: React.CSSProperties       = { padding: '8px 18px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 };
const tabActive: React.CSSProperties    = { backgroundColor: '#dc2626', color: '#fff', borderColor: '#dc2626' };
const formBox: React.CSSProperties      = { display: 'flex', gap: 10, alignItems: 'center', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16, flexWrap: 'wrap' };
const inp: React.CSSProperties          = { padding: '8px 10px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14, minWidth: 180 };
const countryBadge: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, backgroundColor: '#f3f4f6', color: '#374151', fontSize: 14, fontWeight: 600 };
const table: React.CSSProperties        = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const thead: React.CSSProperties        = { backgroundColor: '#f3f4f6' };
const th: React.CSSProperties           = { padding: '11px 14px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' };
const tr: React.CSSProperties           = { borderBottom: '1px solid #f3f4f6' };
const td: React.CSSProperties           = { padding: '11px 14px', fontSize: 14, color: '#111827', verticalAlign: 'middle' };
const pill: React.CSSProperties         = { fontSize: 12, fontWeight: 700, backgroundColor: '#f3f4f6', borderRadius: 6, padding: '2px 8px' };
const statusDot: React.CSSProperties    = { display: 'inline-block', width: 10, height: 10, borderRadius: 5 };
const addBtn: React.CSSProperties       = { padding: '9px 18px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const saveBtn: React.CSSProperties      = { padding: '7px 14px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const cancelBtn: React.CSSProperties    = { padding: '7px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' };
const editBtn: React.CSSProperties      = { padding: '5px 12px', backgroundColor: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151' };
const errBanner: React.CSSProperties    = { width: '100%', padding: '8px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 500 };
