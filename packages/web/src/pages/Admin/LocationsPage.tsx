import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';

interface Location { id: number; value: string; areaId: number | null; isActive: boolean; }
interface Area { id: number; value: string; isActive: boolean; locations: Location[]; }

type ViewMode = 'matrix' | 'cards';

export function LocationsPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [unassigned, setUnassigned] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');

  // Add forms
  const [newArea, setNewArea] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newLocArea, setNewLocArea] = useState<number | null>(null);

  // Inline edit state
  const [editAreaId, setEditAreaId] = useState<number | null>(null);
  const [editAreaName, setEditAreaName] = useState('');
  const [editLocId, setEditLocId] = useState<number | null>(null);
  const [editLocName, setEditLocName] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [areasData, allLocs] = await Promise.all([
        apiClient.getAreas() as Promise<Area[]>,
        apiClient.getLov<Location[]>('locations', { includeInactive: 'true' }),
      ]);
      setAreas(areasData);
      setUnassigned(allLocs.filter((l) => !l.areaId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Add ─────────────────────────────────────────────────────────────────────
  async function handleAddArea() {
    if (!newArea.trim()) return;
    await apiClient.addLovValue('areas', newArea.trim());
    setNewArea(''); load();
  }
  async function handleAddLocation() {
    if (!newLoc.trim()) return;
    await apiClient.addLovValue('locations', newLoc.trim(), { areaId: newLocArea });
    setNewLoc(''); setNewLocArea(null); load();
  }

  // ── Assign ──────────────────────────────────────────────────────────────────
  async function handleAssign(locationId: number, areaId: number | null) {
    await apiClient.updateLovValue('locations', locationId, { areaId });
    load();
  }

  // ── Rename Area ─────────────────────────────────────────────────────────────
  async function handleSaveArea() {
    if (!editAreaId || !editAreaName.trim()) return;
    await apiClient.updateLovValue('areas', editAreaId, { value: editAreaName.trim() });
    setEditAreaId(null); load();
  }

  // ── Rename Location ─────────────────────────────────────────────────────────
  async function handleSaveLoc() {
    if (!editLocId || !editLocName.trim()) return;
    await apiClient.updateLovValue('locations', editLocId, { value: editLocName.trim() });
    setEditLocId(null); load();
  }

  // ── Delete Area ─────────────────────────────────────────────────────────────
  async function handleDeleteArea(id: number, name: string) {
    if (!confirm(`Delete area "${name}"?\n\nAll locations in this area must be moved or deleted first.`)) return;
    try {
      await apiClient.deleteLovValue('areas', id);
      load();
    } catch (e: unknown) { alert((e as Error).message); }
  }

  // ── Delete Location ─────────────────────────────────────────────────────────
  async function handleDeleteLoc(id: number, name: string) {
    if (!confirm(`Permanently delete location "${name}"?`)) return;
    try {
      await apiClient.deleteLovValue('locations', id);
      load();
    } catch (e: unknown) { alert((e as Error).message); }
  }

  // All locations sorted alphabetically for matrix view
  const allLocations: Location[] = [
    ...areas.flatMap((a) => a.locations),
    ...unassigned,
  ].sort((a, b) => a.value.localeCompare(b.value));

  return (
    <div>
      <div style={toolbar}>
        <h2 style={pageTitle}>Location Hierarchy</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...viewBtn, ...(viewMode === 'matrix' ? viewBtnActive : {}) }} onClick={() => setViewMode('matrix')}>⊞ Matrix</button>
          <button style={{ ...viewBtn, ...(viewMode === 'cards' ? viewBtnActive : {}) }} onClick={() => setViewMode('cards')}>☰ Cards</button>
        </div>
      </div>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        Assign locations to areas. Use <strong>Matrix</strong> for bulk assignment or <strong>Cards</strong> for area-by-area management.
      </p>

      {/* ── Add Area ── */}
      <div style={section}>
        <h3 style={sectionTitle}>Add New Area</h3>
        <div style={rowStyle}>
          <input style={input} placeholder="Area name" value={newArea} onChange={(e) => setNewArea(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddArea()} />
          <button style={addBtn} onClick={handleAddArea} disabled={!newArea.trim()}>＋ Add Area</button>
        </div>
      </div>

      {/* ── Add Location ── */}
      <div style={section}>
        <h3 style={sectionTitle}>Add New Location</h3>
        <div style={rowStyle}>
          <input style={input} placeholder="Location name" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} />
          <select style={select} value={newLocArea ?? ''} onChange={(e) => setNewLocArea(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">No area (assign later)</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.value}</option>)}
          </select>
          <button style={addBtn} onClick={handleAddLocation} disabled={!newLoc.trim()}>＋ Add Location</button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center' }}>Loading...</p>
      ) : viewMode === 'matrix' ? (

        /* ════════════════════ MATRIX VIEW ════════════════════ */
        <div style={{ overflowX: 'auto' }}>
          <table style={matrixTable}>
            <thead>
              <tr>
                {/* Location column header */}
                <th style={{ ...matrixTh, textAlign: 'left', minWidth: 200 }}>Location</th>
                {/* Unassigned column */}
                <th style={{ ...matrixTh, color: '#9ca3af', fontStyle: 'italic', minWidth: 100 }}>Unassigned</th>
                {/* One column per area */}
                {areas.map((a) => (
                  <th key={a.id} style={{ ...matrixTh, minWidth: 110 }}>
                    {editAreaId === a.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                        <input
                          style={{ ...inlineInput, width: 100, textAlign: 'center' }}
                          value={editAreaName}
                          onChange={(e) => setEditAreaName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveArea(); if (e.key === 'Escape') setEditAreaId(null); }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={microSaveBtn} onClick={handleSaveArea}>✓</button>
                          <button style={microCancelBtn} onClick={() => setEditAreaId(null)}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ marginBottom: 4 }}>{a.value}</div>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button style={microEditBtn} title="Rename" onClick={() => { setEditAreaId(a.id); setEditAreaName(a.value); }}>✏️</button>
                          <button style={microDeleteBtn} title="Delete" onClick={() => handleDeleteArea(a.id, a.value)}>🗑️</button>
                        </div>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allLocations.map((loc, i) => (
                <tr key={loc.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  {/* Location name cell with edit/delete */}
                  <td style={matrixLocCell}>
                    {editLocId === loc.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          style={{ ...inlineInput, flex: 1 }}
                          value={editLocName}
                          onChange={(e) => setEditLocName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLoc(); if (e.key === 'Escape') setEditLocId(null); }}
                          autoFocus
                        />
                        <button style={microSaveBtn} onClick={handleSaveLoc}>✓</button>
                        <button style={microCancelBtn} onClick={() => setEditLocId(null)}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ flex: 1 }}>{loc.value}</span>
                        <button style={microEditBtn} title="Rename" onClick={() => { setEditLocId(loc.id); setEditLocName(loc.value); }}>✏️</button>
                        <button style={microDeleteBtn} title="Delete" onClick={() => handleDeleteLoc(loc.id, loc.value)}>🗑️</button>
                      </div>
                    )}
                  </td>
                  {/* Unassigned radio */}
                  <td style={matrixCell}>
                    <input type="radio" name={`loc-${loc.id}`} checked={loc.areaId === null}
                      onChange={() => handleAssign(loc.id, null)}
                      style={{ accentColor: '#dc2626', width: 16, height: 16, cursor: 'pointer' }} />
                  </td>
                  {/* One radio per area */}
                  {areas.map((a) => (
                    <td key={a.id} style={matrixCell}>
                      <input type="radio" name={`loc-${loc.id}`} checked={loc.areaId === a.id}
                        onChange={() => handleAssign(loc.id, a.id)}
                        style={{ accentColor: '#dc2626', width: 16, height: 16, cursor: 'pointer' }} />
                    </td>
                  ))}
                </tr>
              ))}
              {allLocations.length === 0 && (
                <tr><td colSpan={areas.length + 2} style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 14 }}>No locations yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

      ) : (

        /* ════════════════════ CARDS VIEW ════════════════════ */
        <>
          {areas.map((area) => (
            <div key={area.id} style={areaCard}>
              <div style={areaHeader}>
                {editAreaId === area.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                    <input style={{ ...inlineInput, flex: 1 }} value={editAreaName} autoFocus
                      onChange={(e) => setEditAreaName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveArea(); if (e.key === 'Escape') setEditAreaId(null); }} />
                    <button style={microSaveBtn} onClick={handleSaveArea}>✓ Save</button>
                    <button style={microCancelBtn} onClick={() => setEditAreaId(null)}>✕</button>
                  </div>
                ) : (
                  <>
                    <span style={areaName}>{area.value}</span>
                    <span style={areaCount}>{area.locations.length} location{area.locations.length !== 1 ? 's' : ''}</span>
                    <button style={editBtn} onClick={() => { setEditAreaId(area.id); setEditAreaName(area.value); }}>✏️ Rename</button>
                    <button style={deleteAreaBtn} onClick={() => handleDeleteArea(area.id, area.value)}>🗑️ Delete</button>
                  </>
                )}
              </div>
              <div style={locList}>
                {area.locations.map((loc) => (
                  <div key={loc.id} style={locItem}>
                    {editLocId === loc.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                        <input style={{ ...inlineInput, flex: 1 }} value={editLocName} autoFocus
                          onChange={(e) => setEditLocName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLoc(); if (e.key === 'Escape') setEditLocId(null); }} />
                        <button style={microSaveBtn} onClick={handleSaveLoc}>✓</button>
                        <button style={microCancelBtn} onClick={() => setEditLocId(null)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: 14 }}>{loc.value}</span>
                        <button style={editBtn} onClick={() => { setEditLocId(loc.id); setEditLocName(loc.value); }}>✏️</button>
                        <button style={unlinkBtn} onClick={() => handleAssign(loc.id, null)}>✕ Unassign</button>
                        <button style={deleteLocBtn} onClick={() => handleDeleteLoc(loc.id, loc.value)}>🗑️</button>
                      </>
                    )}
                  </div>
                ))}
                {area.locations.length === 0 && (
                  <p style={{ fontSize: 13, color: '#9ca3af', padding: '4px 0' }}>No locations assigned.</p>
                )}
              </div>
            </div>
          ))}

          {/* Unassigned */}
          {unassigned.length > 0 && (
            <div style={areaCard}>
              <div style={areaHeader}>
                <span style={{ ...areaName, color: '#9ca3af' }}>Unassigned Locations</span>
                <span style={areaCount}>{unassigned.length}</span>
              </div>
              <div style={locList}>
                {unassigned.map((loc) => (
                  <div key={loc.id} style={locItem}>
                    {editLocId === loc.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                        <input style={{ ...inlineInput, flex: 1 }} value={editLocName} autoFocus
                          onChange={(e) => setEditLocName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLoc(); if (e.key === 'Escape') setEditLocId(null); }} />
                        <button style={microSaveBtn} onClick={handleSaveLoc}>✓</button>
                        <button style={microCancelBtn} onClick={() => setEditLocId(null)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: 14 }}>{loc.value}</span>
                        <button style={editBtn} onClick={() => { setEditLocId(loc.id); setEditLocName(loc.value); }}>✏️</button>
                        <select style={{ ...select, padding: '4px 8px', fontSize: 13 }} value=""
                          onChange={(e) => e.target.value && handleAssign(loc.id, parseInt(e.target.value))}>
                          <option value="">Assign to area...</option>
                          {areas.map((a) => <option key={a.id} value={a.id}>{a.value}</option>)}
                        </select>
                        <button style={deleteLocBtn} onClick={() => handleDeleteLoc(loc.id, loc.value)}>🗑️</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const toolbar: React.CSSProperties        = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 };
const pageTitle: React.CSSProperties      = { fontSize: 22, fontWeight: 700, marginBottom: 0 };
const viewBtn: React.CSSProperties        = { padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 };
const viewBtnActive: React.CSSProperties  = { backgroundColor: '#dc2626', color: '#fff', borderColor: '#dc2626' };
const section: React.CSSProperties        = { backgroundColor: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16, marginBottom: 16 };
const sectionTitle: React.CSSProperties   = { fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 };
const rowStyle: React.CSSProperties       = { display: 'flex', gap: 8 };
const input: React.CSSProperties          = { flex: 1, border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14 };
const select: React.CSSProperties         = { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14, backgroundColor: '#fff' };
const addBtn: React.CSSProperties         = { backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' };
const inlineInput: React.CSSProperties    = { border: '1.5px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13 };
const microEditBtn: React.CSSProperties   = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px', opacity: 0.6 };
const microDeleteBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px', opacity: 0.6 };
const microSaveBtn: React.CSSProperties   = { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 12, cursor: 'pointer' };
const microCancelBtn: React.CSSProperties = { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 12, cursor: 'pointer' };
const editBtn: React.CSSProperties        = { padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151' };
const deleteAreaBtn: React.CSSProperties  = { padding: '3px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#dc2626' };
const deleteLocBtn: React.CSSProperties   = { padding: '3px 8px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#dc2626' };

// Matrix styles
const matrixTable: React.CSSProperties    = { borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', width: '100%', fontSize: 13 };
const matrixTh: React.CSSProperties       = { padding: '10px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', backgroundColor: '#f3f4f6', whiteSpace: 'nowrap' };
const matrixLocCell: React.CSSProperties  = { padding: '6px 12px', fontSize: 14, fontWeight: 500, color: '#111827', borderRight: '1px solid #e5e7eb', minWidth: 200 };
const matrixCell: React.CSSProperties     = { padding: '6px 8px', textAlign: 'center' };

// Cards styles
const areaCard: React.CSSProperties       = { backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 12, overflow: 'hidden' };
const areaHeader: React.CSSProperties     = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb' };
const areaName: React.CSSProperties       = { fontWeight: 700, fontSize: 16, flex: 1 };
const areaCount: React.CSSProperties      = { fontSize: 13, color: '#6b7280', backgroundColor: '#f3f4f6', borderRadius: 20, padding: '2px 10px' };
const locList: React.CSSProperties        = { padding: '8px 16px' };
const locItem: React.CSSProperties        = { display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f9fafb', padding: '8px 0' };
const unlinkBtn: React.CSSProperties      = { padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' };
