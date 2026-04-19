import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

interface LovItem {
  id: number;
  value?: string;
  name?: string;
  defaultUom?: string;
  // Responder-specific
  firstName?: string | null;
  surname?: string | null;
  username?: string | null;
  email?: string | null;
  mobile?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdBy?: string;
  createdAt?: string;
  // Admin-visible org info
  organisation?: {
    id: number;
    name: string;
    country?:  { id: number; name: string; isoCode: string } | null;
    province?: { id: number; name: string } | null;
  } | null;
}

const TABLE_LABELS: Record<string, string> = {
  call_types: 'Call Types', reasons: 'Diagnoses', transports: 'Transports',
  hospitals: 'Hospitals', responders: 'Responders',
  medical_history_presets: 'Medical History Presets', drugs: 'Drugs',
};

export function LovTablePage() {
  const { table } = useParams<{ table: string }>();
  const { auth }  = useAuth();
  const canDelete      = auth?.role === 'SUPER_ADMIN' || auth?.role === 'COUNTRY_SYSADMIN';
  const canSeeUsername = auth?.role === 'SUPER_ADMIN' || auth?.role === 'COUNTRY_SYSADMIN';
  const canSeeAllOrgs  = auth?.role === 'SUPER_ADMIN' || auth?.role === 'COUNTRY_SYSADMIN';

  const [items, setItems]               = useState<LovItem[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading]           = useState(true);

  // Filters (responders + admin roles)
  const [filterCountry,  setFilterCountry]  = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [filterSearch,   setFilterSearch]   = useState('');

  // Add-row state
  const [newValue, setNewValue]         = useState('');
  const [newUom, setNewUom]             = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newSurname, setNewSurname]     = useState('');
  const [newEmail, setNewEmail]         = useState('');
  const [newMobile, setNewMobile]       = useState('');

  // Edit-row state
  const [editId, setEditId]               = useState<number | null>(null);
  const [editValue, setEditValue]         = useState('');
  const [editUom, setEditUom]             = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editSurname, setEditSurname]     = useState('');
  const [editEmail, setEditEmail]         = useState('');
  const [editMobile, setEditMobile]       = useState('');
  const [mobileError, setMobileError]     = useState('');

  const isDrugs      = table === 'drugs';
  const isResponders = table === 'responders';

  const E164_REGEX = /^\+[1-9]\d{7,14}$/;
  function validateMobile(val: string): string {
    if (!val) return '';
    if (!E164_REGEX.test(val)) return 'Use E.164 format, e.g. +27821234567';
    return '';
  }

  async function load() {
    if (!table) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (showInactive) params.includeInactive = 'true';
      // Pass server-side filters for admin roles
      if (isResponders && canSeeAllOrgs) {
        if (filterCountry)  params.countryId  = filterCountry;
        if (filterProvince) params.provinceId = filterProvince;
      }
      const data = await apiClient.getLov<LovItem[]>(table, Object.keys(params).length ? params : undefined);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [table, showInactive]);
  // Re-fetch when admin filters change (server-side filter)
  useEffect(() => {
    if (isResponders && canSeeAllOrgs) load();
  }, [filterCountry, filterProvince]);

  // Client-side text search
  const filtered = isResponders && filterSearch
    ? items.filter((it) => {
        const q    = filterSearch.toLowerCase();
        const name = [it.firstName, it.surname].filter(Boolean).join(' ').toLowerCase();
        return name.includes(q) || (it.username ?? '').toLowerCase().includes(q) || (it.email ?? '').toLowerCase().includes(q);
      })
    : items;

  // Derive province options based on the loaded data (for the province filter dropdown)
  const provinces = Array.from(
    new Map(
      items.map((it) => it.organisation?.province).filter(Boolean).map((p) => [p!.id, p!])
    ).values()
  );

  async function handleAdd() {
    if (!table) return;

    if (isResponders) {
      if (!newFirstName.trim()) { setMobileError('First name is required'); return; }
      if (newMobile.trim()) {
        const err = validateMobile(newMobile.trim());
        if (err) { setMobileError(err); return; }
      }
      setMobileError('');
      try {
        await apiClient.addLovValue(table, newFirstName.trim(), {
          firstName: newFirstName.trim(),
          surname:   newSurname.trim()  || null,
          email:     newEmail.trim()    || null,
          mobile:    newMobile.trim()   || null,
        });
        setNewFirstName(''); setNewSurname(''); setNewEmail(''); setNewMobile('');
        load();
      } catch (e: unknown) {
        setMobileError((e as Error).message ?? 'Save failed');
      }
      return;
    }

    if (!newValue.trim()) return;
    const extra = isDrugs ? { name: newValue.trim(), defaultUom: newUom.trim() || null } : {};
    await apiClient.addLovValue(table, newValue.trim(), extra);
    setNewValue(''); setNewUom('');
    load();
  }

  async function handleSaveEdit(id: number) {
    if (!table) return;

    if (isResponders) {
      if (editMobile) {
        const err = validateMobile(editMobile);
        if (err) { setMobileError(err); return; }
      }
      setMobileError('');
      try {
        await apiClient.updateLovValue(table, id, {
          firstName: editFirstName || null,
          surname:   editSurname   || null,
          email:     editEmail     || null,
          mobile:    editMobile    || null,
        });
        setEditId(null);
        load();
      } catch (e: unknown) {
        setMobileError((e as Error).message ?? 'Save failed');
      }
      return;
    }

    const data = isDrugs ? { name: editValue, defaultUom: editUom || null } : { value: editValue };
    await apiClient.updateLovValue(table, id, data);
    setEditId(null);
    load();
  }

  async function handleDeactivate(id: number) {
    if (!table || !confirm('Deactivate this value? It will no longer appear in pickers.')) return;
    await apiClient.deactivateLovValue(table, id);
    load();
  }

  async function handleReactivate(id: number) {
    if (!table) return;
    await apiClient.updateLovValue(table, id, { isActive: true });
    load();
  }

  async function handleDelete(id: number, label: string) {
    if (!table) return;
    if (!confirm(`Permanently delete "${label}"? This cannot be undone and will fail if the value is in use.`)) return;
    try {
      await apiClient.deleteLovValue(table, id);
      load();
    } catch (e: unknown) {
      alert((e as Error).message ?? 'Delete failed — value may be in use.');
    }
  }

  const displayName  = (item: LovItem) => item.firstName
    ? [item.firstName, item.surname].filter(Boolean).join(' ')
    : (item.name ?? item.value ?? '');

  const displayValue = (item: LovItem) => item.name ?? item.value ?? '';

  return (
    <div>
      <div style={toolbar}>
        <h2 style={pageTitle}>{TABLE_LABELS[table ?? ''] ?? table}</h2>
        <label style={toggleLabel}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {' '}Show inactive
        </label>
      </div>

      {/* ── Filters (responders + admin roles only) ── */}
      {isResponders && canSeeAllOrgs && (
        <div style={filterRow}>
          <select
            style={filterSelect}
            value={filterProvince}
            onChange={(e) => setFilterProvince(e.target.value)}
          >
            <option value="">All Regions</option>
            {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input
            style={{ ...filterSelect, flex: 1, minWidth: 160 }}
            placeholder="Search name, username or email…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
          {(filterProvince || filterSearch) && (
            <button style={clearBtn} onClick={() => { setFilterProvince(''); setFilterSearch(''); }}>Clear</button>
          )}
        </div>
      )}

      {/* ── Add new row ── */}
      <div style={addRow}>
        {isResponders ? (
          <>
            <input
              style={{ ...input, minWidth: 140 }}
              placeholder="First name *"
              value={newFirstName}
              onChange={(e) => { setNewFirstName(e.target.value); setMobileError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <input
              style={{ ...input, minWidth: 140 }}
              placeholder="Surname"
              value={newSurname}
              onChange={(e) => setNewSurname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <input
              style={{ ...input, minWidth: 180 }}
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <input
              style={{ ...input, minWidth: 150, borderColor: mobileError ? '#ef4444' : undefined }}
              placeholder="+27821234567"
              value={newMobile}
              onChange={(e) => { setNewMobile(e.target.value); setMobileError(''); }}
            />
          </>
        ) : (
          <>
            <input
              style={input}
              placeholder={isDrugs ? 'Drug name' : 'New value'}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            {isDrugs && (
              <input style={{ ...input, width: 100 }} placeholder="UOM (e.g. mg)" value={newUom} onChange={(e) => setNewUom(e.target.value)} />
            )}
          </>
        )}
        <button
          style={addBtn}
          onClick={handleAdd}
          disabled={isResponders ? !newFirstName.trim() : !newValue.trim()}
        >
          ＋ Add
        </button>
      </div>
      {isResponders && mobileError && (
        <p style={{ color: '#ef4444', fontSize: 12, margin: '-8px 0 12px 0' }}>{mobileError}</p>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 32 }}>Loading...</p>
      ) : (
        <table style={table_style}>
          <thead>
            <tr style={thead}>
              <th style={th}>#</th>
              {isResponders ? (
                <>
                  <th style={th}>First Name</th>
                  <th style={th}>Surname</th>
                  {canSeeUsername && <th style={th}>Username</th>}
                  <th style={th}>Email</th>
                  <th style={th}>Mobile</th>
                  {canSeeAllOrgs && <th style={th}>Organisation</th>}
                  {canSeeAllOrgs && <th style={th}>Country</th>}
                  {canSeeAllOrgs && <th style={th}>Region</th>}
                </>
              ) : (
                <>
                  <th style={th}>{isDrugs ? 'Drug Name' : 'Value'}</th>
                  {isDrugs && <th style={th}>Default UOM</th>}
                </>
              )}
              <th style={th}>Status</th>
              <th style={th}>Added By</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} style={{ ...tr, opacity: item.isActive ? 1 : 0.5 }}>
                <td style={td}>{item.id}</td>

                {isResponders ? (
                  <>
                    {/* First Name */}
                    <td style={td}>
                      {editId === item.id ? (
                        <input
                          style={inlineInput}
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          placeholder="First name"
                          autoFocus
                        />
                      ) : (
                        <span style={item.isActive ? {} : strikeThroughStyle}>{item.firstName ?? '—'}</span>
                      )}
                    </td>
                    {/* Surname */}
                    <td style={td}>
                      {editId === item.id ? (
                        <input
                          style={inlineInput}
                          value={editSurname}
                          onChange={(e) => setEditSurname(e.target.value)}
                          placeholder="Surname"
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(item.id)}
                        />
                      ) : (
                        <span style={item.isActive ? {} : strikeThroughStyle}>{item.surname ?? '—'}</span>
                      )}
                    </td>
                    {/* Username (read-only, admin-only) */}
                    {canSeeUsername && (
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 13, color: '#374151' }}>
                        {item.username ?? '—'}
                      </td>
                    )}
                    {/* Email */}
                    <td style={td}>
                      {editId === item.id ? (
                        <input
                          style={{ ...inlineInput, width: 180 }}
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Email"
                        />
                      ) : (
                        <span style={{ color: '#374151', fontSize: 13 }}>{item.email ?? '—'}</span>
                      )}
                    </td>
                    {/* Mobile */}
                    <td style={td}>
                      {editId === item.id ? (
                        <>
                          <input
                            style={{ ...inlineInput, width: 140, borderColor: mobileError ? '#ef4444' : undefined }}
                            value={editMobile}
                            onChange={(e) => { setEditMobile(e.target.value); setMobileError(''); }}
                            placeholder="+27821234567"
                          />
                          {mobileError && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>{mobileError}</div>}
                        </>
                      ) : (
                        <span style={{ color: '#374151', fontSize: 13 }}>{item.mobile ?? '—'}</span>
                      )}
                    </td>
                    {/* Org / Country / Province (read-only, admin-only) */}
                    {canSeeAllOrgs && <td style={{ ...td, fontSize: 13 }}>{item.organisation?.name ?? '—'}</td>}
                    {canSeeAllOrgs && <td style={{ ...td, fontSize: 13 }}>{item.organisation?.country?.name ?? '—'}</td>}
                    {canSeeAllOrgs && <td style={{ ...td, fontSize: 13 }}>{item.organisation?.province?.name ?? '—'}</td>}
                  </>
                ) : (
                  <>
                    {/* Generic value column */}
                    <td style={td}>
                      {editId === item.id ? (
                        <input
                          style={inlineInput}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(item.id)}
                        />
                      ) : (
                        <span style={item.isActive ? {} : strikeThroughStyle}>{displayValue(item)}</span>
                      )}
                    </td>
                    {/* Drug UOM */}
                    {isDrugs && (
                      <td style={td}>
                        {editId === item.id ? (
                          <input style={{ ...inlineInput, width: 80 }} value={editUom} onChange={(e) => setEditUom(e.target.value)} />
                        ) : (
                          <span style={{ color: '#6b7280' }}>{item.defaultUom ?? '—'}</span>
                        )}
                      </td>
                    )}
                  </>
                )}

                {/* Status */}
                <td style={td}>
                  <span style={{ ...statusBadge, backgroundColor: item.isActive ? '#dcfce7' : '#f3f4f6', color: item.isActive ? '#16a34a' : '#6b7280' }}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {/* Added By */}
                <td style={{ ...td, color: '#9ca3af', fontSize: 13 }}>{item.createdBy ?? '—'}</td>
                {/* Actions */}
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {editId === item.id ? (
                    <>
                      <button style={actionBtn} onClick={() => handleSaveEdit(item.id)}>Save</button>
                      <button style={cancelBtn} onClick={() => { setEditId(null); setMobileError(''); }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button style={actionBtn} onClick={() => {
                        setEditId(item.id);
                        setEditValue(displayValue(item));
                        setEditUom(item.defaultUom ?? '');
                        setEditFirstName(item.firstName ?? '');
                        setEditSurname(item.surname ?? '');
                        setEditEmail(item.email ?? '');
                        setEditMobile(item.mobile ?? '');
                        setMobileError('');
                      }}>Edit</button>
                      {item.isActive
                        ? <button style={deactivateBtn} onClick={() => handleDeactivate(item.id)}>Deactivate</button>
                        : <button style={actionBtn} onClick={() => handleReactivate(item.id)}>Reactivate</button>
                      }
                      {canDelete && (
                        <button style={deleteBtn} onClick={() => handleDelete(item.id, displayName(item))}>Delete</button>
                      )}
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

const toolbar: React.CSSProperties      = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 };
const pageTitle: React.CSSProperties    = { fontSize: 22, fontWeight: 700 };
const toggleLabel: React.CSSProperties  = { fontSize: 14, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const filterRow: React.CSSProperties    = { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' };
const filterSelect: React.CSSProperties = { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '7px 12px', fontSize: 14 };
const clearBtn: React.CSSProperties     = { border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 14px', fontSize: 13, background: '#f3f4f6', cursor: 'pointer' };
const addRow: React.CSSProperties       = { display: 'flex', gap: 8, marginBottom: 16, padding: 16, backgroundColor: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', flexWrap: 'wrap' };
const input: React.CSSProperties        = { flex: 1, border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14 };
const addBtn: React.CSSProperties       = { backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const table_style: React.CSSProperties  = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const thead: React.CSSProperties        = { backgroundColor: '#f3f4f6' };
const th: React.CSSProperties           = { padding: '12px 14px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' };
const tr: React.CSSProperties           = { borderBottom: '1px solid #f3f4f6' };
const td: React.CSSProperties           = { padding: '12px 14px', fontSize: 14 };
const statusBadge: React.CSSProperties  = { borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600, display: 'inline-block' };
const actionBtn: React.CSSProperties    = { marginRight: 6, padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' };
const cancelBtn: React.CSSProperties    = { ...actionBtn, color: '#6b7280' };
const deactivateBtn: React.CSSProperties = { ...actionBtn, color: '#dc2626', borderColor: '#fca5a5' };
const deleteBtn: React.CSSProperties    = { ...actionBtn, color: '#fff', backgroundColor: '#dc2626', borderColor: '#dc2626' };
const inlineInput: React.CSSProperties  = { border: '1.5px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 14, width: '100%' };
const strikeThroughStyle: React.CSSProperties = { textDecoration: 'line-through', color: '#9ca3af' };
