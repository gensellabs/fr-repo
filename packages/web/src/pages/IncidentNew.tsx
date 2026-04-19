import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { COLOUR_CODES, COLOUR_CODE_STYLES, ColourCode } from '@firstresponders/shared';
import { v4 as uuidv4 } from 'uuid';

interface LovItem { id: number; value?: string; name?: string; defaultUom?: string; }

function display(item: LovItem) { return item.name ?? item.value ?? ''; }

interface PatientForm {
  patientNumber: number;
  name: string;
  age: string;
  gender: 'Male' | 'Female' | null;
  reasonId: number | null;
  colourCode: ColourCode | null;
  medicalHistory: string;
  bpSystolic: string; bpDiastolic: string;
  gcs: string; spo2: string; hr: string; hgt: string;
  transportId: number | null; hospitalId: number | null;
  drugs: Array<{ drugId: number; drugName: string; dosageValue: string; dosageUom: string; timeAdministered: string }>;
}

function emptyPatient(num: number): PatientForm {
  return { patientNumber: num, name: '', age: '', gender: null, reasonId: null, colourCode: null, medicalHistory: '', bpSystolic: '', bpDiastolic: '', gcs: '', spo2: '', hr: '', hgt: 'N/A', transportId: null, hospitalId: null, drugs: [] };
}

export function IncidentNew() {
  const { auth } = useAuth();
  const [lovs, setLovs] = useState<Record<string, LovItem[]>>({});
  const [callTypeId, setCallTypeId] = useState<number | null>(null);
  const [locationText, setLocationText] = useState('');
  const [responderIds, setResponderIds] = useState<number[]>(auth ? [auth.responderId] : []);
  const [patients, setPatients] = useState<PatientForm[]>([emptyPatient(1)]);
  const [activePatient, setActivePatient] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newLovInputs, setNewLovInputs] = useState<Record<string, string>>({});

  const incidentTime = new Date();

  useEffect(() => {
    const tables = ['call_types', 'reasons', 'transports', 'hospitals', 'responders', 'medical_history_presets', 'drugs'];
    Promise.all(
      tables.map(async (t) => ({ table: t, data: await apiClient.getLov<LovItem[]>(t) }))
    ).then((results) => {
      const loaded: Record<string, LovItem[]> = {};
      for (const r of results) loaded[r.table] = r.data as LovItem[];
      setLovs(loaded);
    });
  }, []);

  function setPatientCount(count: number) {
    setPatients((prev) => {
      if (count > prev.length) return [...prev, ...Array.from({ length: count - prev.length }, (_, i) => emptyPatient(prev.length + i + 1))];
      return prev.slice(0, count);
    });
    if (activePatient >= count) setActivePatient(count - 1);
  }

  function updatePatient(idx: number, update: Partial<PatientForm>) {
    setPatients((prev) => prev.map((p, i) => i === idx ? { ...p, ...update } : p));
  }

  async function addLovInline(table: string, value: string, extra?: object) {
    const item = await apiClient.addLovValue(table, value, extra) as LovItem;
    setLovs((l) => ({ ...l, [table]: [...(l[table] ?? []), item] }));
    return item;
  }

  async function handleSave() {
    if (!auth) return;
    setSaving(true);
    try {
      await apiClient.createIncident({
        localId: uuidv4(),
        callTypeId,
        locationText: locationText.trim() || null,
        patientCount: patients.length,
        responderIds,
        primaryResponderId: auth.responderId,
        patients: patients.map((p) => ({
          ...p,
          name: p.name || null,
          age: p.age ? parseInt(p.age) : null,
          gender: p.gender ?? null,
          bpSystolic: p.bpSystolic ? parseInt(p.bpSystolic) : null,
          bpDiastolic: p.bpDiastolic ? parseInt(p.bpDiastolic) : null,
          gcs: p.gcs ? parseInt(p.gcs) : null,
          spo2: p.spo2 ? parseInt(p.spo2) : null,
          hr: p.hr ? parseInt(p.hr) : null,
          drugs: p.drugs.map((d) => ({ ...d, dosageValue: d.dosageValue ? parseFloat(d.dosageValue) : null })),
        })),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Reset form
      setCallTypeId(null); setLocationText('');
      setPatients([emptyPatient(1)]); setActivePatient(0);
    } catch (e) {
      alert('Failed to save incident.');
    } finally {
      setSaving(false);
    }
  }

  const p = patients[activePatient];

  return (
    <div>
      <div style={formHeader}>
        <div>
          <h2 style={pageTitle}>New Incident</h2>
          <p style={dateTime}>
            {incidentTime.toLocaleDateString('en-ZA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            {' — '}
            {incidentTime.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </p>
        </div>
        {saved && <div style={savedBanner}>✓ Incident saved successfully</div>}
        <button style={saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : '💾 Save Incident'}
        </button>
      </div>

      <div style={twoCol}>
        {/* Left column — incident header */}
        <div style={col}>
          <section style={section}>
            <h3 style={sectionTitle}>Incident Details</h3>
            <div style={grid2}>
              <LovSelect label="Call Type *" options={lovs['call_types']} value={callTypeId} onChange={setCallTypeId} table="call_types" onAdd={addLovInline} setLov={() => {}} />
              <div>
                <label style={fieldLabel}>Location <span style={{ color: '#9ca3af', fontWeight: 400 }}>(max 25 chars)</span></label>
                <input
                  style={vitalInput}
                  type="text"
                  placeholder="e.g. Main Rd intersection"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value.slice(0, 25))}
                  maxLength={25}
                />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{locationText.length}/25</span>
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Responders on Scene</label>
              <div style={chipWrap}>
                {(lovs['responders'] ?? []).map((r) => {
                  const sel = responderIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      style={{ ...chip, ...(sel ? chipSelected : {}) }}
                      onClick={() => {
                        if (r.id === auth?.responderId) return; // can't deselect yourself
                        setResponderIds(sel ? responderIds.filter((x) => x !== r.id) : [...responderIds, r.id]);
                      }}
                    >{display(r)}</button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Patient count */}
          <section style={section}>
            <h3 style={sectionTitle}>Patients</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={fieldLabel}>Count:</label>
              <button style={stepBtn} onClick={() => setPatientCount(Math.max(1, patients.length - 1))}>−</button>
              <span style={{ fontSize: 24, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{patients.length}</span>
              <button style={stepBtn} onClick={() => setPatientCount(patients.length + 1)}>＋</button>
            </div>
            {patients.length > 1 && (
              <div style={patientTabs}>
                {patients.map((_, i) => (
                  <button key={i} style={{ ...patientTab, ...(activePatient === i ? patientTabActive : {}) }} onClick={() => setActivePatient(i)}>
                    Patient {i + 1}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column — patient card */}
        <div style={col}>
          <section style={section}>
            <h3 style={sectionTitle}>Patient {p.patientNumber} — Clinical Details</h3>

            {/* Name, Age, Gender */}
            <div style={grid2}>
              <div>
                <label style={fieldLabel}>Name</label>
                <input style={vitalInput} type="text" placeholder="Patient name (optional)" value={p.name} onChange={(e) => updatePatient(activePatient, { name: e.target.value })} autoCapitalize="words" />
              </div>
              <div>
                <label style={fieldLabel}>Age (years)</label>
                <input style={vitalInput} type="number" placeholder="e.g. 45" min={0} max={150} value={p.age} onChange={(e) => updatePatient(activePatient, { age: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Gender</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['Male', 'Female'] as const).map((g) => (
                  <button
                    key={g}
                    style={{ ...chip, ...(p.gender === g ? chipSelected : {}), minWidth: 90 }}
                    onClick={() => updatePatient(activePatient, { gender: p.gender === g ? null : g })}
                  >{g}</button>
                ))}
              </div>
            </div>

            <LovSelect label="Diagnosis" options={lovs['reasons']} value={p.reasonId} onChange={(v) => updatePatient(activePatient, { reasonId: v })} table="reasons" onAdd={addLovInline} setLov={() => {}} />

            <div>
              <label style={fieldLabel}>Triage Colour Code</label>
              <div style={codeRow}>
                {COLOUR_CODES.map((code) => {
                  const cs = COLOUR_CODE_STYLES[code];
                  return (
                    <button
                      key={code}
                      style={{ ...codeBtn, backgroundColor: cs.bg, opacity: p.colourCode === code ? 1 : 0.45, outline: p.colourCode === code ? '3px solid #000' : 'none' }}
                      onClick={() => updatePatient(activePatient, { colourCode: code })}
                      title={cs.description}
                    >
                      {cs.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={vitalsGrid}>
              <div>
                <label style={fieldLabel}>Blood Pressure</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input style={{ ...vitalInput, width: 70 }} type="number" placeholder="SYS" value={p.bpSystolic} onChange={(e) => updatePatient(activePatient, { bpSystolic: e.target.value })} />
                  <span style={{ fontSize: 20, color: '#9ca3af' }}>/</span>
                  <input style={{ ...vitalInput, width: 70 }} type="number" placeholder="DIA" value={p.bpDiastolic} onChange={(e) => updatePatient(activePatient, { bpDiastolic: e.target.value })} />
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>mmHg</span>
                </div>
              </div>
              {([['GCS', 'gcs', '3–15'], ['SpO2', 'spo2', '%'], ['HR', 'hr', 'bpm'], ['HGT', 'hgt', 'mmol/L']] as [string, keyof PatientForm, string][]).map(([lbl, f, unit]) => (
                <div key={f}>
                  <label style={fieldLabel}>{lbl} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({unit})</span></label>
                  <input style={vitalInput} value={String(p[f] ?? '')} onChange={(e) => updatePatient(activePatient, { [f]: e.target.value })} type={f === 'hgt' ? 'text' : 'number'} />
                </div>
              ))}
            </div>

            <div>
              <label style={fieldLabel}>Medical History</label>
              <div style={chipWrap}>
                {(lovs['medical_history_presets'] ?? []).map((preset) => {
                  const sel = p.medicalHistory.includes(preset.value ?? '');
                  return (
                    <button key={preset.id} style={{ ...chip, ...(sel ? chipSelected : {}) }} onClick={() => {
                      const parts = p.medicalHistory.split(', ').filter(Boolean);
                      const pv = preset.value ?? '';
                      updatePatient(activePatient, { medicalHistory: (sel ? parts.filter((x) => x !== pv) : [...parts, pv]).join(', ') });
                    }}>{display(preset)}</button>
                  );
                })}
              </div>
              <textarea style={textarea} value={p.medicalHistory} onChange={(e) => updatePatient(activePatient, { medicalHistory: e.target.value })} placeholder="Additional medical history..." rows={2} />
            </div>

            <div>
              <label style={fieldLabel}>Drugs Administered</label>
              {p.drugs.map((d, di) => (
                <div key={di} style={drugRow}>
                  <span style={{ fontWeight: 600, flex: 2, fontSize: 14 }}>{d.drugName}</span>
                  <input style={{ ...vitalInput, width: 70 }} type="number" placeholder="Dose" value={d.dosageValue} onChange={(e) => updatePatient(activePatient, { drugs: p.drugs.map((x, xi) => xi === di ? { ...x, dosageValue: e.target.value } : x) })} />
                  <input style={{ ...vitalInput, width: 60 }} placeholder="UOM" value={d.dosageUom} onChange={(e) => updatePatient(activePatient, { drugs: p.drugs.map((x, xi) => xi === di ? { ...x, dosageUom: e.target.value } : x) })} />
                  <input style={{ ...vitalInput, width: 80 }} placeholder="HH:MM" value={d.timeAdministered} onChange={(e) => updatePatient(activePatient, { drugs: p.drugs.map((x, xi) => xi === di ? { ...x, timeAdministered: e.target.value } : x) })} />
                  <button style={rmBtn} onClick={() => updatePatient(activePatient, { drugs: p.drugs.filter((_, xi) => xi !== di) })}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <select style={selectStyle} value="" onChange={(e) => {
                  const drug = (lovs['drugs'] ?? []).find((d) => d.id === parseInt(e.target.value));
                  if (!drug) return;
                  updatePatient(activePatient, { drugs: [...p.drugs, { drugId: drug.id, drugName: drug.name ?? '', dosageValue: '', dosageUom: drug.defaultUom ?? '', timeAdministered: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }) }] });
                }}>
                  <option value="">＋ Add drug...</option>
                  {(lovs['drugs'] ?? []).map((d) => <option key={d.id} value={d.id}>{d.name} {d.defaultUom ? `(${d.defaultUom})` : ''}</option>)}
                </select>
              </div>
            </div>

            <div style={grid2}>
              <LovSelect label="Transport" options={lovs['transports']} value={p.transportId} onChange={(v) => updatePatient(activePatient, { transportId: v })} table="transports" onAdd={addLovInline} setLov={() => {}} />
              <LovSelect label="Hospital" options={lovs['hospitals']} value={p.hospitalId} onChange={(v) => updatePatient(activePatient, { hospitalId: v })} table="hospitals" onAdd={addLovInline} setLov={() => {}} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Inline LOV select with "add new" support
function LovSelect({ label, options = [], value, onChange, table, onAdd }: {
  label: string; options?: LovItem[]; value: number | null;
  onChange: (v: number | null) => void; table: string;
  onAdd: (table: string, value: string) => Promise<LovItem>;
  setLov: (fn: (prev: Record<string, LovItem[]>) => Record<string, LovItem[]>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState('');

  async function handleAdd() {
    if (!newVal.trim()) return;
    setAdding(true);
    try {
      const item = await onAdd(table, newVal.trim());
      onChange(item.id);
      setNewVal('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <select style={{ ...selectStyle, flex: 1 }} value={value ?? ''} onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}>
          <option value="">Select...</option>
          {options.map((o) => <option key={o.id} value={o.id}>{display(o)}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input style={{ ...vitalInput, flex: 1, fontSize: 12, padding: '5px 8px' }} placeholder="Add new..." value={newVal} onChange={(e) => setNewVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button style={{ ...saveBtn, padding: '5px 12px', fontSize: 12 }} onClick={handleAdd} disabled={!newVal.trim() || adding}>
          {adding ? '...' : '＋'}
        </button>
      </div>
    </div>
  );
}

const formHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 };
const pageTitle: React.CSSProperties = { fontSize: 24, fontWeight: 700 };
const dateTime: React.CSSProperties = { color: '#6b7280', fontSize: 14 };
const savedBanner: React.CSSProperties = { backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '10px 16px', fontWeight: 600, fontSize: 14 };
const saveBtn: React.CSSProperties = { backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 15 };
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' };
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };
const section: React.CSSProperties = { backgroundColor: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 14 };
const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#111827' };
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const selectStyle: React.CSSProperties = { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '9px 10px', fontSize: 14, backgroundColor: '#fff' };
const chipWrap: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 };
const chip: React.CSSProperties = { border: '1.5px solid #e5e7eb', borderRadius: 20, padding: '6px 12px', backgroundColor: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' };
const chipSelected: React.CSSProperties = { borderColor: '#dc2626', backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 600 };
const codeRow: React.CSSProperties = { display: 'flex', gap: 8 };
const codeBtn: React.CSSProperties = { flex: 1, padding: '10px 4px', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 13, textShadow: '0 1px 2px rgba(0,0,0,0.4)', transition: 'opacity 0.15s, outline 0.15s' };
const vitalsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'auto repeat(4, 1fr)', gap: 12, alignItems: 'end' };
const vitalInput: React.CSSProperties = { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 14, width: '100%', backgroundColor: '#fff' };
const textarea: React.CSSProperties = { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 14, marginTop: 6, resize: 'vertical' };
const drugRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' };
const rmBtn: React.CSSProperties = { color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 };
const stepBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 18, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 20, fontWeight: 700, color: '#dc2626' };
const patientTabs: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 };
const patientTab: React.CSSProperties = { padding: '7px 16px', borderRadius: 20, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' };
const patientTabActive: React.CSSProperties = { borderColor: '#dc2626', backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 700 };
