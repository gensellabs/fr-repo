/**
 * Geographic Hierarchy management
 *
 * SuperAdmin    → Countries | Regions | Districts | Areas  (all data, full CRUD)
 * CountryAdmin  → Regions | Districts | Areas  (scoped to own country, full CRUD)
 * GroupAdmin    → Areas  (org-scoped areas, full CRUD)
 */
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Country  { id: number; name: string; isoCode: string; isActive: boolean }
interface Region   { id: number; name: string; countryId: number; isActive: boolean; country?: { name: string } }
interface District { id: number; name: string; provinceId: number; isActive: boolean; province?: { name: string; country?: { name: string } } }
interface Area     { id: number; value: string; districtId?: number | null; organisationId?: number | null; isActive: boolean; district?: { name: string; province?: { name: string; country?: { name: string } } } }

type Tab = 'countries' | 'regions' | 'districts' | 'areas';

// ─── Component ────────────────────────────────────────────────────────────────

export function HierarchyPage() {
  const { auth } = useAuth();
  const isSuperAdmin   = auth?.role === 'SUPER_ADMIN';
  const isCountryAdmin = auth?.role === 'COUNTRY_SYSADMIN';
  const isGroupAdmin   = auth?.role === 'GROUP_SYSADMIN' || auth?.role === 'GROUP_ADMIN';

  // Determine visible tabs per role
  const visibleTabs: Tab[] = isSuperAdmin
    ? ['countries', 'regions', 'districts', 'areas']
    : isCountryAdmin
    ? ['regions', 'districts', 'areas']
    : ['areas']; // GroupAdmin

  const defaultTab: Tab = visibleTabs[0];
  const [tab, setTab]     = useState<Tab>(defaultTab);

  // Data
  const [countries,  setCountries]  = useState<Country[]>([]);
  const [regions,    setRegions]    = useState<Region[]>([]);
  const [districts,  setDistricts]  = useState<District[]>([]);
  const [areas,      setAreas]      = useState<Area[]>([]);
  const [loading,    setLoading]    = useState(false);

  // Cascade dropdowns for add forms
  const [allCountries,  setAllCountries]  = useState<Country[]>([]);
  const [allRegions,    setAllRegions]    = useState<Region[]>([]);
  const [allDistricts,  setAllDistricts]  = useState<District[]>([]);

  // Add/Edit form
  const [addMode, setAddMode] = useState(false);
  const [form,    setForm]    = useState<Record<string, string>>({});
  const [saving,  setSaving]  = useState(false);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Column filters (client-side)
  const [f, setF] = useState<Record<string, string>>({});

  // ── Load cascade dropdowns once ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (isSuperAdmin || isCountryAdmin) {
        const cid = isCountryAdmin ? auth?.countryId : undefined;
        const [r, d] = await Promise.all([
          apiClient.getRegions(cid) as Promise<Region[]>,
          apiClient.getDistricts(undefined, cid) as Promise<District[]>,
        ]);
        setAllRegions(r);
        setAllDistricts(d);
      }
      if (isSuperAdmin) {
        const c = await apiClient.getCountries(true) as Country[];
        setAllCountries(c);
      }
    })();
  }, []);

  useEffect(() => { load(); }, [tab]);

  async function load() {
    setLoading(true);
    setF({});
    try {
      const cid = isCountryAdmin ? auth?.countryId : undefined;
      if (tab === 'countries') setCountries(await apiClient.getCountries(true) as Country[]);
      if (tab === 'regions')   setRegions(await apiClient.getRegions(cid) as Region[]);
      if (tab === 'districts') setDistricts(await apiClient.getDistricts(undefined, cid) as District[]);
      if (tab === 'areas') {
        if (isGroupAdmin) {
          setAreas(await apiClient.getGroupAreas() as Area[]);
        } else {
          setAreas(await apiClient.getHierarchyAreas(undefined, cid) as Area[]);
        }
      }
    } finally { setLoading(false); }
  }

  // ── CRUD handlers ────────────────────────────────────────────────────────────

  async function handleAdd() {
    setError(null); setSaving(true);
    try {
      if (tab === 'countries') {
        if (!form.name?.trim()) { setError('Country name is required.'); return; }
        if (!form.isoCode?.trim()) { setError('ISO code is required.'); return; }
        await apiClient.createCountry({ name: form.name.trim(), isoCode: form.isoCode.trim() });
      }
      if (tab === 'regions') {
        if (!form.name?.trim()) { setError('Region name is required.'); return; }
        const countryId = isCountryAdmin ? auth?.countryId : Number(form.countryId);
        if (!countryId) { setError('Please select a country.'); return; }
        await apiClient.createRegion({ name: form.name.trim(), countryId });
        // Refresh cascade dropdown
        const updatedRegions = await apiClient.getRegions(isCountryAdmin ? auth?.countryId : undefined) as Region[];
        setAllRegions(updatedRegions);
      }
      if (tab === 'districts') {
        if (!form.name?.trim()) { setError('District name is required.'); return; }
        if (!form.provinceId) { setError('Please select a region.'); return; }
        await apiClient.createDistrict({ name: form.name.trim(), provinceId: Number(form.provinceId) });
        const cid = isCountryAdmin ? auth?.countryId : undefined;
        const updatedDistricts = await apiClient.getDistricts(undefined, cid) as District[];
        setAllDistricts(updatedDistricts);
      }
      if (tab === 'areas') {
        if (!form.value?.trim()) { setError('Area name is required.'); return; }
        if (isGroupAdmin) {
          await apiClient.createGroupArea({ value: form.value.trim() });
        } else {
          if (!form.districtId) { setError('Please select a district.'); return; }
          await apiClient.createHierarchyArea({ value: form.value.trim(), districtId: Number(form.districtId) });
        }
      }
      setAddMode(false); setForm({});
      load();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleSaveEdit(id: number) {
    setError(null); setSaving(true);
    try {
      if (tab === 'countries') await apiClient.updateCountry(id, { name: form.name, isoCode: form.isoCode, isActive: form.isActive === 'true' });
      if (tab === 'regions')   await apiClient.updateRegion(id, { name: form.name, isActive: form.isActive === 'true' });
      if (tab === 'districts') await apiClient.updateDistrict(id, { name: form.name, isActive: form.isActive === 'true' });
      if (tab === 'areas') {
        const updater = isGroupAdmin ? apiClient.updateGroupArea : apiClient.updateHierarchyArea;
        await updater(id, { value: form.value, isActive: form.isActive === 'true' });
      }
      setEditId(null); setForm({});
      load();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggle(id: number, isActive: boolean) {
    try {
      if (tab === 'countries') await apiClient.updateCountry(id, { isActive: !isActive });
      if (tab === 'regions')   await apiClient.updateRegion(id, { isActive: !isActive });
      if (tab === 'districts') await apiClient.updateDistrict(id, { isActive: !isActive });
      if (tab === 'areas') {
        const updater = isGroupAdmin ? apiClient.updateGroupArea : apiClient.updateHierarchyArea;
        await updater(id, { isActive: !isActive });
      }
      load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleDelete(id: number) {
    try {
      if (tab === 'countries') await apiClient.deleteCountry(id);
      if (tab === 'regions')   await apiClient.deleteRegion(id);
      if (tab === 'districts') await apiClient.deleteDistrict(id);
      if (tab === 'areas') {
        if (isGroupAdmin) await apiClient.deleteGroupArea(id);
        else              await apiClient.deleteHierarchyArea(id);
      }
      setConfirmDeleteId(null);
      load();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  // ── Filtered data (client-side) ──────────────────────────────────────────────

  const filteredCountries = countries.filter((r) =>
    (!f.name    || r.name.toLowerCase().includes(f.name.toLowerCase())) &&
    (!f.isoCode || r.isoCode.toLowerCase().includes(f.isoCode.toLowerCase()))
  );

  const filteredRegions = regions.filter((r) =>
    (!f.country || (r.country?.name ?? '').toLowerCase().includes(f.country.toLowerCase())) &&
    (!f.name    || r.name.toLowerCase().includes(f.name.toLowerCase()))
  );

  const filteredDistricts = districts.filter((r) =>
    (!f.country || (r.province?.country?.name ?? '').toLowerCase().includes(f.country.toLowerCase())) &&
    (!f.region  || (r.province?.name ?? '').toLowerCase().includes(f.region.toLowerCase())) &&
    (!f.name    || r.name.toLowerCase().includes(f.name.toLowerCase()))
  );

  const filteredAreas = areas.filter((r) =>
    (!f.country  || (r.district?.province?.country?.name ?? '').toLowerCase().includes(f.country.toLowerCase())) &&
    (!f.region   || (r.district?.province?.name ?? '').toLowerCase().includes(f.region.toLowerCase())) &&
    (!f.district || (r.district?.name ?? '').toLowerCase().includes(f.district.toLowerCase())) &&
    (!f.name     || r.value.toLowerCase().includes(f.name.toLowerCase()))
  );

  const tabLabels: Record<Tab, string> = {
    countries: 'Countries',
    regions:   'Regions',
    districts: 'Districts',
    areas:     'Areas',
  };

  const subtitle = isSuperAdmin
    ? 'Manage countries, regions, districts and areas globally.'
    : isCountryAdmin
    ? `Manage regions, districts and areas within ${auth?.countryName ?? 'your country'}.`
    : 'Manage areas for your group.';

  // ── Render helpers ────────────────────────────────────────────────────────────

  function filterInput(key: string, placeholder: string) {
    return (
      <input
        style={filterInp}
        placeholder={placeholder}
        value={f[key] ?? ''}
        onChange={(e) => setF((prev) => ({ ...prev, [key]: e.target.value }))}
      />
    );
  }

  function activeToggleBtn(id: number, isActive: boolean) {
    return (
      <button
        style={{ ...actionBtn, color: isActive ? '#dc2626' : '#16a34a' }}
        onClick={() => handleToggle(id, isActive)}
      >
        {isActive ? 'Deactivate' : 'Activate'}
      </button>
    );
  }

  function deleteBtn(id: number) {
    return confirmDeleteId === id ? (
      <>
        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Confirm?</span>
        <button style={{ ...actionBtn, color: '#dc2626', fontWeight: 700 }} onClick={() => handleDelete(id)}>Yes</button>
        <button style={actionBtn} onClick={() => setConfirmDeleteId(null)}>No</button>
      </>
    ) : (
      <button style={{ ...actionBtn, color: '#9ca3af' }} onClick={() => setConfirmDeleteId(id)}>Delete</button>
    );
  }

  // ── Add form ─────────────────────────────────────────────────────────────────

  const addForm = addMode && (
    <div style={formBox}>
      {tab === 'countries' && (
        <>
          <input placeholder="Country name *" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
          <input placeholder="ISO code (e.g. ZAF) *" value={form.isoCode ?? ''} onChange={(e) => setForm({ ...form, isoCode: e.target.value })} style={{ ...inp, maxWidth: 120 }} maxLength={3} />
        </>
      )}
      {tab === 'regions' && (
        <>
          <input placeholder="Region name *" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
          {isSuperAdmin ? (
            <select value={form.countryId ?? ''} onChange={(e) => setForm({ ...form, countryId: e.target.value })} style={inp}>
              <option value="">— Select country *—</option>
              {allCountries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <span style={badge}>{auth?.countryName ?? 'Your country'}</span>
          )}
        </>
      )}
      {tab === 'districts' && (
        <>
          <input placeholder="District name *" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
          <select value={form.provinceId ?? ''} onChange={(e) => setForm({ ...form, provinceId: e.target.value })} style={inp}>
            <option value="">— Select region *—</option>
            {allRegions.map((r) => (
              <option key={r.id} value={r.id}>
                {isSuperAdmin && r.country?.name ? `${r.country.name} › ` : ''}{r.name}
              </option>
            ))}
          </select>
        </>
      )}
      {tab === 'areas' && !isGroupAdmin && (
        <>
          <input placeholder="Area name *" value={form.value ?? ''} onChange={(e) => setForm({ ...form, value: e.target.value })} style={inp} />
          <select value={form.districtId ?? ''} onChange={(e) => setForm({ ...form, districtId: e.target.value })} style={inp}>
            <option value="">— Select district *—</option>
            {allDistricts.map((d) => (
              <option key={d.id} value={d.id}>
                {isSuperAdmin && d.province?.country?.name ? `${d.province.country.name} › ` : ''}
                {d.province?.name} › {d.name}
              </option>
            ))}
          </select>
        </>
      )}
      {tab === 'areas' && isGroupAdmin && (
        <input placeholder="Area name *" value={form.value ?? ''} onChange={(e) => setForm({ ...form, value: e.target.value })} style={inp} />
      )}
      <button style={saveBtn} onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      <button style={cancelBtn} onClick={() => { setAddMode(false); setForm({}); setError(null); }}>Cancel</button>
      {error && <div style={errBanner}>⚠ {error}</div>}
    </div>
  );

  // ── Tables ────────────────────────────────────────────────────────────────────

  function renderCountriesTable() {
    const showSA = isSuperAdmin;
    return (
      <table style={tableStyle}>
        <thead>
          <tr style={filterRow}>
            <th style={th}>{filterInput('name', 'Filter name…')}</th>
            <th style={th}>{filterInput('isoCode', 'Filter ISO…')}</th>
            <th style={{ ...th, width: 60 }} />
            <th style={{ ...th, width: 220 }} />
          </tr>
          <tr style={theadRow}>
            <th style={th}>Country Name</th>
            <th style={{ ...th, width: 80 }}>ISO</th>
            <th style={{ ...th, width: 60, textAlign: 'center' }}>Active</th>
            <th style={{ ...th, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredCountries.map((row) => (
            <tr key={row.id} style={trStyle}>
              <td style={td}>
                {editId === row.id
                  ? <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inp, width: 200 }} />
                  : <span style={{ fontWeight: 600 }}>{row.name}</span>}
              </td>
              <td style={td}>
                {editId === row.id
                  ? <input value={form.isoCode ?? ''} onChange={(e) => setForm({ ...form, isoCode: e.target.value })} style={{ ...inp, maxWidth: 80 }} maxLength={3} />
                  : <span style={pill}>{row.isoCode}</span>}
              </td>
              <td style={{ ...td, textAlign: 'center' }}>
                <span style={{ ...dot, backgroundColor: row.isActive ? '#16a34a' : '#d1d5db' }} />
              </td>
              <td style={{ ...td, textAlign: 'right' }}>
                {editId === row.id
                  ? <><button style={saveBtn} onClick={() => handleSaveEdit(row.id)} disabled={saving}>Save</button><button style={cancelBtn} onClick={() => { setEditId(null); setError(null); }}>Cancel</button></>
                  : <>{showSA && <button style={actionBtn} onClick={() => { setEditId(row.id); setForm({ name: row.name, isoCode: row.isoCode }); }}>Edit</button>}
                    {activeToggleBtn(row.id, row.isActive)}{showSA && deleteBtn(row.id)}</>}
              </td>
            </tr>
          ))}
          {filteredCountries.length === 0 && <EmptyRow colSpan={4} label="countries" />}
        </tbody>
      </table>
    );
  }

  function renderRegionsTable() {
    return (
      <table style={tableStyle}>
        <thead>
          <tr style={filterRow}>
            {isSuperAdmin && <th style={th}>{filterInput('country', 'Filter country…')}</th>}
            <th style={th}>{filterInput('name', 'Filter region…')}</th>
            <th style={{ ...th, width: 60 }} />
            <th style={{ ...th, width: 220 }} />
          </tr>
          <tr style={theadRow}>
            {isSuperAdmin && <th style={th}>Country</th>}
            <th style={th}>Region Name</th>
            <th style={{ ...th, width: 60, textAlign: 'center' }}>Active</th>
            <th style={{ ...th, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredRegions.map((row) => (
            <tr key={row.id} style={trStyle}>
              {isSuperAdmin && <td style={td}>{row.country?.name}</td>}
              <td style={td}>
                {editId === row.id
                  ? <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inp, width: 220 }} />
                  : <span style={{ fontWeight: 600 }}>{row.name}</span>}
              </td>
              <td style={{ ...td, textAlign: 'center' }}>
                <span style={{ ...dot, backgroundColor: row.isActive ? '#16a34a' : '#d1d5db' }} />
              </td>
              <td style={{ ...td, textAlign: 'right' }}>
                {editId === row.id
                  ? <><button style={saveBtn} onClick={() => handleSaveEdit(row.id)} disabled={saving}>Save</button><button style={cancelBtn} onClick={() => { setEditId(null); setError(null); }}>Cancel</button></>
                  : <><button style={actionBtn} onClick={() => { setEditId(row.id); setForm({ name: row.name }); }}>Edit</button>
                    {activeToggleBtn(row.id, row.isActive)}{deleteBtn(row.id)}</>}
              </td>
            </tr>
          ))}
          {filteredRegions.length === 0 && <EmptyRow colSpan={isSuperAdmin ? 4 : 3} label="regions" />}
        </tbody>
      </table>
    );
  }

  function renderDistrictsTable() {
    return (
      <table style={tableStyle}>
        <thead>
          <tr style={filterRow}>
            {isSuperAdmin && <th style={th}>{filterInput('country', 'Filter country…')}</th>}
            <th style={th}>{filterInput('region', 'Filter region…')}</th>
            <th style={th}>{filterInput('name', 'Filter district…')}</th>
            <th style={{ ...th, width: 60 }} />
            <th style={{ ...th, width: 220 }} />
          </tr>
          <tr style={theadRow}>
            {isSuperAdmin && <th style={th}>Country</th>}
            <th style={th}>Region</th>
            <th style={th}>District Name</th>
            <th style={{ ...th, width: 60, textAlign: 'center' }}>Active</th>
            <th style={{ ...th, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredDistricts.map((row) => (
            <tr key={row.id} style={trStyle}>
              {isSuperAdmin && <td style={td}>{row.province?.country?.name}</td>}
              <td style={td}>{row.province?.name}</td>
              <td style={td}>
                {editId === row.id
                  ? <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inp, width: 200 }} />
                  : <span style={{ fontWeight: 600 }}>{row.name}</span>}
              </td>
              <td style={{ ...td, textAlign: 'center' }}>
                <span style={{ ...dot, backgroundColor: row.isActive ? '#16a34a' : '#d1d5db' }} />
              </td>
              <td style={{ ...td, textAlign: 'right' }}>
                {editId === row.id
                  ? <><button style={saveBtn} onClick={() => handleSaveEdit(row.id)} disabled={saving}>Save</button><button style={cancelBtn} onClick={() => { setEditId(null); setError(null); }}>Cancel</button></>
                  : <><button style={actionBtn} onClick={() => { setEditId(row.id); setForm({ name: row.name }); }}>Edit</button>
                    {activeToggleBtn(row.id, row.isActive)}{deleteBtn(row.id)}</>}
              </td>
            </tr>
          ))}
          {filteredDistricts.length === 0 && <EmptyRow colSpan={isSuperAdmin ? 5 : 4} label="districts" />}
        </tbody>
      </table>
    );
  }

  function renderAreasTable() {
    return (
      <table style={tableStyle}>
        <thead>
          <tr style={filterRow}>
            {isSuperAdmin   && <th style={th}>{filterInput('country',  'Filter country…')}</th>}
            {!isGroupAdmin  && <th style={th}>{filterInput('region',   'Filter region…')}</th>}
            {!isGroupAdmin  && <th style={th}>{filterInput('district', 'Filter district…')}</th>}
            <th style={th}>{filterInput('name', 'Filter area…')}</th>
            <th style={{ ...th, width: 60 }} />
            <th style={{ ...th, width: 220 }} />
          </tr>
          <tr style={theadRow}>
            {isSuperAdmin   && <th style={th}>Country</th>}
            {!isGroupAdmin  && <th style={th}>Region</th>}
            {!isGroupAdmin  && <th style={th}>District</th>}
            <th style={th}>Area Name</th>
            <th style={{ ...th, width: 60, textAlign: 'center' }}>Active</th>
            <th style={{ ...th, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAreas.map((row) => (
            <tr key={row.id} style={trStyle}>
              {isSuperAdmin   && <td style={td}>{row.district?.province?.country?.name}</td>}
              {!isGroupAdmin  && <td style={td}>{row.district?.province?.name}</td>}
              {!isGroupAdmin  && <td style={td}>{row.district?.name}</td>}
              <td style={td}>
                {editId === row.id
                  ? <input value={form.value ?? ''} onChange={(e) => setForm({ ...form, value: e.target.value })} style={{ ...inp, width: 200 }} />
                  : <span style={{ fontWeight: 600 }}>{row.value}</span>}
              </td>
              <td style={{ ...td, textAlign: 'center' }}>
                <span style={{ ...dot, backgroundColor: row.isActive ? '#16a34a' : '#d1d5db' }} />
              </td>
              <td style={{ ...td, textAlign: 'right' }}>
                {editId === row.id
                  ? <><button style={saveBtn} onClick={() => handleSaveEdit(row.id)} disabled={saving}>Save</button><button style={cancelBtn} onClick={() => { setEditId(null); setError(null); }}>Cancel</button></>
                  : <><button style={actionBtn} onClick={() => { setEditId(row.id); setForm({ value: row.value }); }}>Edit</button>
                    {activeToggleBtn(row.id, row.isActive)}{deleteBtn(row.id)}</>}
              </td>
            </tr>
          ))}
          {filteredAreas.length === 0 && <EmptyRow colSpan={isGroupAdmin ? 3 : isSuperAdmin ? 6 : 5} label="areas" />}
        </tbody>
      </table>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={toolbar}>
        <div>
          <h2 style={pageTitle}>Geographic Hierarchy</h2>
          <p style={subtitleStyle}>{subtitle}</p>
        </div>
        <button style={addBtn} onClick={() => { setAddMode(true); setForm({}); setError(null); setEditId(null); }}>
          + Add {tabLabels[tab].replace(/s$/, '')}
        </button>
      </div>

      {/* Tabs */}
      {visibleTabs.length > 1 && (
        <div style={tabsBar}>
          {visibleTabs.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setAddMode(false); setEditId(null); setError(null); setConfirmDeleteId(null); }}
              style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      {addForm}

      {/* Errors outside add form */}
      {!addMode && error && <div style={{ ...errBanner, marginBottom: 12 }}>⚠ {error}</div>}

      {/* Table */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 40 }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {tab === 'countries'  && renderCountriesTable()}
          {tab === 'regions'    && renderRegionsTable()}
          {tab === 'districts'  && renderDistrictsTable()}
          {tab === 'areas'      && renderAreasTable()}
        </div>
      )}
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        No {label} found. Use the + Add button to create one.
      </td>
    </tr>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const toolbar: React.CSSProperties       = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 };
const pageTitle: React.CSSProperties     = { fontSize: 24, fontWeight: 700, margin: 0 };
const subtitleStyle: React.CSSProperties = { color: '#6b7280', fontSize: 14, marginTop: 4 };
const addBtn: React.CSSProperties        = { padding: '9px 18px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };
const tabsBar: React.CSSProperties       = { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' };
const tabBtn: React.CSSProperties        = { padding: '8px 18px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 };
const tabActive: React.CSSProperties     = { backgroundColor: '#dc2626', color: '#fff', borderColor: '#dc2626' };
const formBox: React.CSSProperties       = { display: 'flex', gap: 10, alignItems: 'center', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16, flexWrap: 'wrap' };
const inp: React.CSSProperties           = { padding: '8px 10px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14, minWidth: 180 };
const badge: React.CSSProperties         = { padding: '8px 12px', borderRadius: 8, backgroundColor: '#f3f4f6', color: '#374151', fontSize: 14, fontWeight: 600 };
const tableStyle: React.CSSProperties    = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const filterRow: React.CSSProperties     = { backgroundColor: '#f9fafb' };
const theadRow: React.CSSProperties      = { backgroundColor: '#f3f4f6' };
const filterInp: React.CSSProperties     = { width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, backgroundColor: '#fff', boxSizing: 'border-box' };
const th: React.CSSProperties            = { padding: '8px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' };
const trStyle: React.CSSProperties       = { borderBottom: '1px solid #f3f4f6' };
const td: React.CSSProperties            = { padding: '10px 12px', fontSize: 14, color: '#111827', verticalAlign: 'middle' };
const pill: React.CSSProperties          = { fontSize: 12, fontWeight: 700, backgroundColor: '#f3f4f6', borderRadius: 6, padding: '2px 8px' };
const dot: React.CSSProperties           = { display: 'inline-block', width: 10, height: 10, borderRadius: 5 };
const saveBtn: React.CSSProperties       = { padding: '6px 14px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const cancelBtn: React.CSSProperties     = { padding: '6px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' };
const actionBtn: React.CSSProperties     = { padding: '4px 10px', backgroundColor: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151', marginLeft: 4 };
const errBanner: React.CSSProperties     = { width: '100%', padding: '8px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 500 };
