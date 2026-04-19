/**
 * Geographic Hierarchy management — side-by-side column layout
 *
 * SuperAdmin    → Countries | Regions | Districts | Areas  (all data, full CRUD)
 * CountryAdmin  → Regions | Districts | Areas  (scoped to own country, full CRUD)
 * GroupAdmin    → Areas  (org-scoped areas, full CRUD)
 *
 * Filter bar uses MultiSelect dropdowns (same pattern as History.tsx) with
 * cascading cross-column behaviour: selecting a Country narrows Region options,
 * selecting Regions narrows District options, etc.
 */
import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Country  { id: number; name: string; isoCode: string; isActive: boolean }
interface Region   { id: number; name: string; countryId: number; isActive: boolean; country?: { name: string } }
interface District { id: number; name: string; provinceId: number; isActive: boolean; province?: { name: string; country?: { name: string } } }
interface Area     { id: number; value: string; districtId?: number | null; organisationId?: number | null; isActive: boolean; district?: { name: string } }
interface LovItem  { id: number; value: string }

type ColKey = 'countries' | 'regions' | 'districts' | 'areas';

function singularize(s: string): string {
  if (s.endsWith('ies')) return s.slice(0, -3) + 'y';
  if (s.endsWith('s'))   return s.slice(0, -1);
  return s;
}

// ─── MultiSelect dropdown ─────────────────────────────────────────────────────

function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: LovItem[]; selected: number[]; onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const count = selected.length;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          border: '1.5px solid #d1d5db', borderRadius: 8, padding: '7px 12px', fontSize: 13,
          background: count > 0 ? '#fef2f2' : '#fff', cursor: 'pointer',
          fontWeight: count > 0 ? 600 : 400, color: count > 0 ? '#dc2626' : '#374151',
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}
      >
        {label}{count > 0 && ` (${count})`} <span style={{ fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 200, backgroundColor: '#fff',
          border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: 180, maxHeight: 280, overflowY: 'auto',
        }}>
          {count > 0 && (
            <button
              onClick={() => onChange([])}
              style={{ width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#dc2626', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}
            >
              Clear all
            </button>
          )}
          {options.length === 0 && (
            <p style={{ padding: '12px 14px', fontSize: 13, color: '#9ca3af', margin: 0 }}>No options</p>
          )}
          {options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', backgroundColor: checked ? '#fef2f2' : 'transparent' }}>
                <input
                  type="checkbox" checked={checked}
                  onChange={() => onChange(checked ? selected.filter((id) => id !== opt.id) : [...selected, opt.id])}
                  style={{ accentColor: '#dc2626' }}
                />
                <span style={{ fontSize: 13, color: '#111827' }}>{opt.value}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HierarchyPage() {
  const { auth } = useAuth();
  const isSuperAdmin   = auth?.role === 'SUPER_ADMIN';
  const isCountryAdmin = auth?.role === 'COUNTRY_SYSADMIN';
  const isGroupAdmin   = auth?.role === 'GROUP_SYSADMIN' || auth?.role === 'GROUP_ADMIN';

  // ── Data ──────────────────────────────────────────────────────────────────
  const [countries,  setCountries]  = useState<Country[]>([]);
  const [regions,    setRegions]    = useState<Region[]>([]);
  const [districts,  setDistricts]  = useState<District[]>([]);
  const [areas,      setAreas]      = useState<Area[]>([]);
  const [loading,    setLoading]    = useState(true);

  // ── Filter selections ─────────────────────────────────────────────────────
  const [selCountries,  setSelCountries]  = useState<number[]>([]);
  const [selRegions,    setSelRegions]    = useState<number[]>([]);
  const [selDistricts,  setSelDistricts]  = useState<number[]>([]);
  const [selAreas,      setSelAreas]      = useState<number[]>([]);
  const [areaTextFilter, setAreaTextFilter] = useState('');  // GroupAdmin only

  // ── CRUD state (shared across columns) ───────────────────────────────────
  const [addMode,         setAddMode]         = useState<ColKey | null>(null);
  const [form,            setForm]            = useState<Record<string, string>>({});
  const [editId,          setEditId]          = useState<{ col: ColKey; id: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<{ col: ColKey; id: number } | null>(null);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  // ── Load all data ─────────────────────────────────────────────────────────

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const cid = isCountryAdmin ? auth?.countryId : undefined;
      if (isSuperAdmin) {
        const [c, r, d, a] = await Promise.all([
          apiClient.getCountries(true) as Promise<Country[]>,
          apiClient.getRegions()       as Promise<Region[]>,
          apiClient.getDistricts()     as Promise<District[]>,
          apiClient.getHierarchyAreas() as Promise<Area[]>,
        ]);
        setCountries(c); setRegions(r); setDistricts(d); setAreas(a);
      } else if (isCountryAdmin) {
        const [r, d, a] = await Promise.all([
          apiClient.getRegions(cid)               as Promise<Region[]>,
          apiClient.getDistricts(undefined, cid)  as Promise<District[]>,
          apiClient.getHierarchyAreas(undefined, cid) as Promise<Area[]>,
        ]);
        setRegions(r); setDistricts(d); setAreas(a);
      } else {
        // GroupAdmin — org-scoped areas only
        setAreas(await apiClient.getGroupAreas() as Area[]);
      }
    } finally { setLoading(false); }
  }

  // ── Cascading derived data for display ────────────────────────────────────

  const shownCountries = selCountries.length === 0
    ? countries
    : countries.filter((c) => selCountries.includes(c.id));

  const shownRegions = (() => {
    let r = regions;
    if (selCountries.length > 0) r = r.filter((x) => selCountries.includes(x.countryId));
    if (selRegions.length   > 0) r = r.filter((x) => selRegions.includes(x.id));
    return r;
  })();

  const shownRegionIds = new Set(shownRegions.map((r) => r.id));

  const shownDistricts = (() => {
    let d = districts;
    if (selCountries.length > 0 || selRegions.length > 0) d = d.filter((x) => shownRegionIds.has(x.provinceId));
    if (selDistricts.length > 0) d = d.filter((x) => selDistricts.includes(x.id));
    return d;
  })();

  const shownDistrictIds = new Set(shownDistricts.map((d) => d.id));

  const shownAreas = (() => {
    let a = areas;
    if (selCountries.length > 0 || selRegions.length > 0 || selDistricts.length > 0) {
      a = a.filter((x) => x.districtId != null && shownDistrictIds.has(x.districtId));
    }
    if (selAreas.length > 0) a = a.filter((x) => selAreas.includes(x.id));
    return a;
  })();

  // GroupAdmin simple text filter
  const groupShownAreas = isGroupAdmin && areaTextFilter
    ? areas.filter((a) => a.value.toLowerCase().includes(areaTextFilter.toLowerCase()))
    : areas;

  // ── MultiSelect dropdown options (cascade-aware) ──────────────────────────

  const countryOptions = countries.map((c) => ({ id: c.id, value: c.name }));

  const regionOptions = (selCountries.length > 0
    ? regions.filter((r) => selCountries.includes(r.countryId))
    : regions
  ).map((r) => ({ id: r.id, value: r.name }));

  const districtOptions = (selCountries.length > 0 || selRegions.length > 0
    ? districts.filter((d) => shownRegionIds.has(d.provinceId))
    : districts
  ).map((d) => ({ id: d.id, value: d.name }));

  const areaOptions = (selCountries.length > 0 || selRegions.length > 0 || selDistricts.length > 0
    ? areas.filter((a) => a.districtId != null && shownDistrictIds.has(a.districtId))
    : areas
  ).map((a) => ({ id: a.id, value: a.value }));

  const hasFilter = selCountries.length > 0 || selRegions.length > 0 || selDistricts.length > 0 || selAreas.length > 0;

  // ── Helper: populate edit form from current data ──────────────────────────

  function getEditForm(col: ColKey, id: number): Record<string, string> {
    if (col === 'countries') {
      const c = countries.find((x) => x.id === id);
      return c ? { name: c.name, isoCode: c.isoCode } : {};
    }
    if (col === 'regions')   { const r = regions.find((x) => x.id === id);   return r ? { name: r.name }   : {}; }
    if (col === 'districts') { const d = districts.find((x) => x.id === id); return d ? { name: d.name }   : {}; }
    if (col === 'areas')     { const a = areas.find((x) => x.id === id);     return a ? { value: a.value } : {}; }
    return {};
  }

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  async function handleAdd(col: ColKey) {
    setError(null); setSaving(true);
    try {
      if (col === 'countries') {
        if (!form.name?.trim())    { setError('Country name is required.'); return; }
        if (!form.isoCode?.trim()) { setError('ISO code is required.'); return; }
        await apiClient.createCountry({ name: form.name.trim(), isoCode: form.isoCode.trim() });
      } else if (col === 'regions') {
        if (!form.name?.trim()) { setError('Region name is required.'); return; }
        const countryId = isCountryAdmin ? auth?.countryId : Number(form.countryId);
        if (!countryId) { setError('Please select a country.'); return; }
        await apiClient.createRegion({ name: form.name.trim(), countryId });
      } else if (col === 'districts') {
        if (!form.name?.trim()) { setError('District name is required.'); return; }
        if (!form.provinceId)   { setError('Please select a region.'); return; }
        await apiClient.createDistrict({ name: form.name.trim(), provinceId: Number(form.provinceId) });
      } else if (col === 'areas') {
        if (!form.value?.trim()) { setError('Area name is required.'); return; }
        if (isGroupAdmin) {
          await apiClient.createGroupArea({ value: form.value.trim() });
        } else {
          if (!form.districtId) { setError('Please select a district.'); return; }
          await apiClient.createHierarchyArea({ value: form.value.trim(), districtId: Number(form.districtId) });
        }
      }
      setAddMode(null); setForm({});
      loadAll();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleSaveEdit(col: ColKey, id: number) {
    setError(null); setSaving(true);
    try {
      if (col === 'countries')      await apiClient.updateCountry(id, { name: form.name, isoCode: form.isoCode });
      else if (col === 'regions')   await apiClient.updateRegion(id, { name: form.name });
      else if (col === 'districts') await apiClient.updateDistrict(id, { name: form.name });
      else if (col === 'areas') {
        if (isGroupAdmin) await apiClient.updateGroupArea(id, { value: form.value });
        else              await apiClient.updateHierarchyArea(id, { value: form.value });
      }
      setEditId(null); setForm({});
      loadAll();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggle(col: ColKey, id: number, isActive: boolean) {
    try {
      if (col === 'countries')      await apiClient.updateCountry(id, { isActive: !isActive });
      else if (col === 'regions')   await apiClient.updateRegion(id, { isActive: !isActive });
      else if (col === 'districts') await apiClient.updateDistrict(id, { isActive: !isActive });
      else if (col === 'areas') {
        if (isGroupAdmin) await apiClient.updateGroupArea(id, { isActive: !isActive });
        else              await apiClient.updateHierarchyArea(id, { isActive: !isActive });
      }
      loadAll();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  async function handleDelete(col: ColKey, id: number) {
    try {
      if (col === 'countries')      await apiClient.deleteCountry(id);
      else if (col === 'regions')   await apiClient.deleteRegion(id);
      else if (col === 'districts') await apiClient.deleteDistrict(id);
      else if (col === 'areas') {
        if (isGroupAdmin) await apiClient.deleteGroupArea(id);
        else              await apiClient.deleteHierarchyArea(id);
      }
      setConfirmDeleteId(null);
      loadAll();
    } catch (e: unknown) { setError((e as Error).message); }
  }

  // ── Column renderer ───────────────────────────────────────────────────────

  function renderColumn(
    col: ColKey,
    title: string,
    items: Array<{ id: number; label: string; isActive: boolean; sub?: string }>,
    addFormContent: React.ReactNode,
  ) {
    const isAdding = addMode === col;

    return (
      <div style={colCard} key={col}>
        {/* Column header */}
        <div style={colHeader}>
          <span style={colTitleStyle}>{title}</span>
          <span style={colCountBadge}>{items.length}</span>
        </div>

        {/* Inline add form */}
        {isAdding && (
          <div style={colAddFormBox}>
            {addFormContent}
            {error && addMode === col && <div style={{ ...errBanner, marginTop: 6 }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button style={saveBtn} onClick={() => handleAdd(col)} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button style={cancelBtn} onClick={() => { setAddMode(null); setForm({}); setError(null); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Items list */}
        <div style={colBody}>
          {items.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 12px', margin: 0 }}>
              No {title.toLowerCase()} found.
            </p>
          ) : (
            items.map((item) => {
              const isEditing          = editId?.col === col && editId.id === item.id;
              const isConfirmingDelete = confirmDeleteId?.col === col && confirmDeleteId.id === item.id;
              return (
                <div key={item.id} style={{ ...colItem, opacity: item.isActive ? 1 : 0.5 }}>
                  {isEditing ? (
                    /* ── Edit form ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {col === 'areas'
                        ? <input value={form.value ?? ''} onChange={(e) => setForm({ ...form, value: e.target.value })} style={inp} placeholder="Area name *" autoFocus />
                        : <input value={form.name  ?? ''} onChange={(e) => setForm({ ...form, name:  e.target.value })} style={inp} placeholder="Name *" autoFocus />
                      }
                      {col === 'countries' && (
                        <input value={form.isoCode ?? ''} onChange={(e) => setForm({ ...form, isoCode: e.target.value })} style={inp} maxLength={3} placeholder="ISO code *" />
                      )}
                      {error && editId?.id === item.id && <div style={errBanner}>⚠ {error}</div>}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={saveBtn} onClick={() => handleSaveEdit(col, item.id)} disabled={saving}>Save</button>
                        <button style={cancelBtn} onClick={() => { setEditId(null); setError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* ── Read-only row ── */
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ ...dotStyle, backgroundColor: item.isActive ? '#16a34a' : '#d1d5db', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</span>
                          {item.sub && <span style={isoChip}>{item.sub}</span>}
                        </div>
                        {isConfirmingDelete ? (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Delete?</span>
                            <button style={{ ...miniBtn, color: '#dc2626', fontWeight: 700 }} onClick={() => handleDelete(col, item.id)}>Yes</button>
                            <button style={miniBtn} onClick={() => setConfirmDeleteId(null)}>No</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                            <button style={miniBtn} onClick={() => {
                              setEditId({ col, id: item.id });
                              setForm(getEditForm(col, item.id));
                              setError(null);
                              setConfirmDeleteId(null);
                            }}>Edit</button>
                            <button
                              style={{ ...miniBtn, color: item.isActive ? '#dc2626' : '#16a34a' }}
                              onClick={() => handleToggle(col, item.id, item.isActive)}
                            >
                              {item.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              style={{ ...miniBtn, color: '#9ca3af' }}
                              onClick={() => { setConfirmDeleteId({ col, id: item.id }); setEditId(null); }}
                            >Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer — "+ Add" button */}
        {!isAdding && (
          <div style={colFooter}>
            <button
              style={addColBtn}
              onClick={() => {
                setAddMode(col); setForm({}); setError(null);
                setEditId(null); setConfirmDeleteId(null);
              }}
            >
              + Add {singularize(title)}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Add-form content per column ───────────────────────────────────────────

  const countriesAddForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input placeholder="Country name *" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} autoFocus />
      <input placeholder="ISO code (e.g. ZAF) *" value={form.isoCode ?? ''} onChange={(e) => setForm({ ...form, isoCode: e.target.value })} style={inp} maxLength={3} />
    </div>
  );

  const regionsAddForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input placeholder="Region name *" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} autoFocus />
      {isSuperAdmin ? (
        <select value={form.countryId ?? ''} onChange={(e) => setForm({ ...form, countryId: e.target.value })} style={inp}>
          <option value="">— Select country *—</option>
          {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      ) : (
        <span style={badge}>{auth?.countryName ?? 'Your country'}</span>
      )}
    </div>
  );

  const districtsAddForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input placeholder="District name *" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} autoFocus />
      <select value={form.provinceId ?? ''} onChange={(e) => setForm({ ...form, provinceId: e.target.value })} style={inp}>
        <option value="">— Select region *—</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {isSuperAdmin && r.country?.name ? `${r.country.name} › ` : ''}{r.name}
          </option>
        ))}
      </select>
    </div>
  );

  const areasAddForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input placeholder="Area name *" value={form.value ?? ''} onChange={(e) => setForm({ ...form, value: e.target.value })} style={inp} autoFocus />
      {!isGroupAdmin && (
        <select value={form.districtId ?? ''} onChange={(e) => setForm({ ...form, districtId: e.target.value })} style={inp}>
          <option value="">— Select district *—</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {isSuperAdmin && d.province?.country?.name ? `${d.province.country.name} › ` : ''}
              {d.province?.name ? `${d.province.name} › ` : ''}{d.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  // ── Page subtitle ─────────────────────────────────────────────────────────

  const subtitle = isSuperAdmin
    ? 'Manage countries, regions, districts and areas globally.'
    : isCountryAdmin
    ? `Manage regions, districts and areas within ${auth?.countryName ?? 'your country'}.`
    : 'Manage areas for your group.';

  const numCols = isSuperAdmin ? 4 : isCountryAdmin ? 3 : 1;

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div style={toolbar}>
        <div>
          <h2 style={pageTitle}>Geographic Hierarchy</h2>
          <p style={subtitleStyle}>{subtitle}</p>
        </div>
      </div>

      {/* ── Filter bar (SuperAdmin + CountryAdmin) ── */}
      {!isGroupAdmin && (
        <div style={filterBar}>
          {isSuperAdmin && (
            <MultiSelect
              label="Country"
              options={countryOptions}
              selected={selCountries}
              onChange={(ids) => { setSelCountries(ids); setSelRegions([]); setSelDistricts([]); setSelAreas([]); }}
            />
          )}
          <MultiSelect
            label="Region"
            options={regionOptions}
            selected={selRegions}
            onChange={(ids) => { setSelRegions(ids); setSelDistricts([]); setSelAreas([]); }}
          />
          <MultiSelect
            label="District"
            options={districtOptions}
            selected={selDistricts}
            onChange={(ids) => { setSelDistricts(ids); setSelAreas([]); }}
          />
          <MultiSelect
            label="Area"
            options={areaOptions}
            selected={selAreas}
            onChange={setSelAreas}
          />
          {hasFilter && (
            <button style={clearBtn} onClick={() => { setSelCountries([]); setSelRegions([]); setSelDistricts([]); setSelAreas([]); }}>
              ✕ Clear all
            </button>
          )}
        </div>
      )}

      {/* ── GroupAdmin text filter ── */}
      {isGroupAdmin && (
        <div style={{ marginBottom: 16 }}>
          <input
            placeholder="Search areas…"
            value={areaTextFilter}
            onChange={(e) => setAreaTextFilter(e.target.value)}
            style={{ border: '1.5px solid #d1d5db', borderRadius: 8, padding: '7px 12px', fontSize: 14, minWidth: 220 }}
          />
          {areaTextFilter && (
            <button
              style={{ marginLeft: 8, ...clearBtn }}
              onClick={() => setAreaTextFilter('')}
            >✕</button>
          )}
        </div>
      )}

      {/* Global error (not tied to a specific add/edit operation) */}
      {error && !addMode && !editId && (
        <div style={{ ...errBanner, marginBottom: 12 }}>⚠ {error}</div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 48 }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${numCols}, minmax(220px, 1fr))`,
            gap: 16,
            alignItems: 'start',
          }}>
            {isSuperAdmin && renderColumn(
              'countries',
              'Countries',
              shownCountries.map((c) => ({ id: c.id, label: c.name, isActive: c.isActive, sub: c.isoCode })),
              countriesAddForm,
            )}
            {(isSuperAdmin || isCountryAdmin) && renderColumn(
              'regions',
              'Regions',
              shownRegions.map((r) => ({ id: r.id, label: r.name, isActive: r.isActive })),
              regionsAddForm,
            )}
            {(isSuperAdmin || isCountryAdmin) && renderColumn(
              'districts',
              'Districts',
              shownDistricts.map((d) => ({ id: d.id, label: d.name, isActive: d.isActive })),
              districtsAddForm,
            )}
            {renderColumn(
              'areas',
              'Areas',
              (isGroupAdmin ? groupShownAreas : shownAreas).map((a) => ({ id: a.id, label: a.value, isActive: a.isActive })),
              areasAddForm,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const toolbar: React.CSSProperties       = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 };
const pageTitle: React.CSSProperties     = { fontSize: 24, fontWeight: 700, margin: 0 };
const subtitleStyle: React.CSSProperties = { color: '#6b7280', fontSize: 14, marginTop: 4 };
const filterBar: React.CSSProperties     = { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' };
const clearBtn: React.CSSProperties      = { border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 14px', fontSize: 13, background: '#f3f4f6', cursor: 'pointer' };
const colCard: React.CSSProperties       = { backgroundColor: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const colHeader: React.CSSProperties     = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' };
const colTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' };
const colCountBadge: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#6b7280', backgroundColor: '#e5e7eb', borderRadius: 12, padding: '2px 8px' };
const colAddFormBox: React.CSSProperties = { padding: '12px 14px', backgroundColor: '#fef9f9', borderBottom: '1px solid #fecaca' };
const colBody: React.CSSProperties       = { flex: 1, maxHeight: 520, overflowY: 'auto' };
const colItem: React.CSSProperties       = { padding: '10px 14px', borderBottom: '1px solid #f3f4f6' };
const colFooter: React.CSSProperties     = { padding: '10px 14px', borderTop: '1px solid #f3f4f6' };
const addColBtn: React.CSSProperties     = { width: '100%', padding: '8px', backgroundColor: 'transparent', border: '1.5px dashed #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6b7280', fontWeight: 500 };
const inp: React.CSSProperties           = { padding: '7px 10px', borderRadius: 7, border: '1.5px solid #d1d5db', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const badge: React.CSSProperties         = { padding: '7px 12px', borderRadius: 7, backgroundColor: '#f3f4f6', color: '#374151', fontSize: 13, fontWeight: 600 };
const saveBtn: React.CSSProperties       = { padding: '6px 14px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const cancelBtn: React.CSSProperties     = { padding: '6px 14px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' };
const miniBtn: React.CSSProperties       = { padding: '3px 8px', backgroundColor: 'transparent', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: 12, cursor: 'pointer', color: '#374151' };
const isoChip: React.CSSProperties       = { fontSize: 11, fontWeight: 700, backgroundColor: '#f3f4f6', borderRadius: 5, padding: '1px 6px', color: '#374151' };
const dotStyle: React.CSSProperties      = { display: 'inline-block', width: 8, height: 8, borderRadius: 4 };
const errBanner: React.CSSProperties     = { padding: '8px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 500 };
