import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../api/client';
import { COLOUR_CODE_STYLES } from '@firstresponders/shared';
import { useAuth } from '../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Drug { drug: { name: string }; dosageValue: number | null; dosageUom: string | null; timeAdministered: string | null; }
interface Patient { colourCode: string | null; patientNumber: number; name: string | null; age: number | null; gender: string | null; reason: { value: string } | null; bpSystolic: number | null; bpDiastolic: number | null; gcs: number | null; spo2: number | null; hr: number | null; hgt: string | null; medicalHistory: string | null; drugs: Drug[]; transport: { value: string } | null; hospital: { value: string } | null; }
interface Organisation { id: number; name: string; district?: { id: number; name: string; province?: { id: number; name: string; country?: { id: number; name: string } } }; }
interface IncidentPhoto { id: number; capturedAt: string; latitude: number | null; longitude: number | null; altitude: number | null; }
interface Incident {
  id: number; incidentDate: string;
  callType: { id: number; value: string } | null;
  location: { value: string; area: { id: number; value: string } | null } | null;
  organisation: Organisation | null;
  patientCount: number;
  patients: Patient[];
  responders: Array<{ responder: { id: number; value: string } }>;
  photos: IncidentPhoto[];
}
interface LovItem { id: number; value: string; }
interface HierarchyItem { id: number; name: string; }

const COLOUR_ORDER = ['Green', 'Yellow', 'Orange', 'Red', 'Blue'];

function worstCode(patients: Patient[]): string | null {
  return patients.reduce<string | null>((worst, p) => {
    const idx = p.colourCode ? COLOUR_ORDER.indexOf(p.colourCode) : -1;
    return idx > (worst ? COLOUR_ORDER.indexOf(worst) : -1) ? p.colourCode : worst;
  }, null);
}

// ─── Multi-select dropdown ────────────────────────────────────────────────────

function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: LovItem[]; selected: number[]; onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
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
          background: count > 0 ? '#fef2f2' : '#fff', cursor: 'pointer', fontWeight: count > 0 ? 600 : 400,
          color: count > 0 ? '#dc2626' : '#374151', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
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
            <button onClick={() => onChange([])} style={{ width: '100%', padding: '8px 14px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#dc2626', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>
              Clear all
            </button>
          )}
          {options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', backgroundColor: checked ? '#fef2f2' : 'transparent' }}>
                <input type="checkbox" checked={checked} onChange={() => onChange(checked ? selected.filter((id) => id !== opt.id) : [...selected, opt.id])} style={{ accentColor: '#dc2626' }} />
                <span style={{ fontSize: 13, color: '#111827' }}>{opt.value}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Photo Viewer ─────────────────────────────────────────────────────────────

function PhotoStrip({ photos }: { photos: IncidentPhoto[] }) {
  const [blobUrls, setBlobUrls] = useState<Record<number, string>>({});
  const [enlarged, setEnlarged] = useState<string | null>(null);

  useEffect(() => {
    if (photos.length === 0) return;
    const token = localStorage.getItem('auth_token');
    const newUrls: Record<number, string> = {};
    Promise.all(
      photos.map(async (p) => {
        try {
          const res = await fetch(`/api/photos/${p.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const blob = await res.blob();
          newUrls[p.id] = URL.createObjectURL(blob);
        } catch { /* ignore */ }
      })
    ).then(() => setBlobUrls(newUrls));
    return () => { Object.values(newUrls).forEach(URL.revokeObjectURL); };
  }, [photos.map((p) => p.id).join(',')]);

  if (photos.length === 0) return null;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {photos.map((p) => (
          <div key={p.id} style={{ position: 'relative' }}>
            {blobUrls[p.id] ? (
              <img
                src={blobUrls[p.id]}
                alt={`Photo ${p.id}`}
                onClick={() => setEnlarged(blobUrls[p.id]!)}
                style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '2px solid #e5e7eb' }}
              />
            ) : (
              <div style={{ width: 90, height: 90, borderRadius: 8, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9ca3af' }}>
                Loading…
              </div>
            )}
            {p.capturedAt && (
              <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', marginTop: 2 }}>
                {new Date(p.capturedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
            )}
          </div>
        ))}
      </div>
      {enlarged && (
        <div
          onClick={() => setEnlarged(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <img src={enlarged} alt="Full size" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
          <button onClick={() => setEnlarged(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: '#fff', fontSize: 32, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </>
  );
}

// ─── Incident Detail Panel ────────────────────────────────────────────────────

function IncidentDetail({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const d = new Date(incident.incidentDate);
  return (
    <div style={panelOverlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={panelHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Incident #{incident.id}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              {d.toLocaleDateString('en-ZA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · {d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', padding: 4 }}>✕</button>
        </div>

        <div style={panelBody}>
          {/* Incident details */}
          <div style={detailCard}>
            <h4 style={cardHead}>Incident Details</h4>
            <DetailRow label="Call Type" value={incident.callType?.value} />
            <DetailRow label="Area" value={incident.location?.area?.value} />
            <DetailRow label="Location" value={(incident as unknown as { locationText?: string }).locationText ?? incident.location?.value} />
            {incident.organisation && (
              <>
                <DetailRow label="Group" value={incident.organisation.name} />
                <DetailRow label="District" value={incident.organisation.district?.name} />
                <DetailRow label="Region" value={incident.organisation.district?.province?.name} />
                <DetailRow label="Country" value={incident.organisation.district?.province?.country?.name} />
              </>
            )}
            <DetailRow label="Responders" value={incident.responders.map((r) => r.responder.value).join(', ')} />
            {incident.photos.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                  Photos ({incident.photos.length})
                </span>
                <PhotoStrip photos={incident.photos} />
              </div>
            )}
          </div>

          {/* Patients */}
          {incident.patients.map((p) => {
            const cs = p.colourCode ? COLOUR_CODE_STYLES[p.colourCode as keyof typeof COLOUR_CODE_STYLES] : null;
            return (
              <div key={p.patientNumber} style={detailCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ ...cardHead, marginBottom: 0 }}>Patient {p.patientNumber}{p.name ? ` — ${p.name}` : ''}</h4>
                  {cs && <span style={{ backgroundColor: cs.bg, color: '#fff', borderRadius: 6, padding: '2px 12px', fontWeight: 700, fontSize: 13 }}>{cs.label}</span>}
                </div>
                {p.age != null && <DetailRow label="Age" value={`${p.age} years`} />}
                {p.gender && <DetailRow label="Gender" value={p.gender} />}
                {p.reason && <DetailRow label="Diagnosis" value={p.reason.value} />}
                {(p.bpSystolic || p.bpDiastolic) && <DetailRow label="Blood Pressure" value={`${p.bpSystolic ?? '?'}/${p.bpDiastolic ?? '?'} mmHg`} />}
                {p.gcs != null && <DetailRow label="GCS" value={String(p.gcs)} />}
                {p.spo2 != null && <DetailRow label="SpO2" value={`${p.spo2}%`} />}
                {p.hr != null && <DetailRow label="Heart Rate" value={`${p.hr} bpm`} />}
                {p.hgt && p.hgt !== 'N/A' && <DetailRow label="HGT" value={p.hgt} />}
                {p.medicalHistory && <DetailRow label="Medical History" value={p.medicalHistory} />}
                {p.drugs.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Drugs Administered</span>
                    {p.drugs.map((d, i) => (
                      <div key={i} style={{ fontSize: 13, color: '#111827', marginTop: 4, paddingLeft: 8 }}>
                        • {d.drug.name} {d.dosageValue}{d.dosageUom}
                        {d.timeAdministered ? ` @ ${d.timeAdministered}` : ''}
                      </div>
                    ))}
                  </div>
                )}
                {p.transport && <DetailRow label="Transport" value={p.transport.value} />}
                {p.hospital && <DetailRow label="Hospital" value={p.hospital.value} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #f9fafb' }}>
      <span style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 2, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ─── Main History Component ───────────────────────────────────────────────────

export function History() {
  const { auth } = useAuth();
  const isAdminUser = auth?.role === 'SUPER_ADMIN' || auth?.role === 'COUNTRY_SYSADMIN';
  const isSuperAdmin = auth?.role === 'SUPER_ADMIN';

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Incident | null>(null);

  // Standard filter state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState<number[]>([]);
  const [areaFilter, setAreaFilter] = useState<number[]>([]);
  const [codeFilter, setCodeFilter] = useState<number[]>([]);
  const [responderFilter, setResponderFilter] = useState<number[]>([]);

  // Hierarchy filter state (admin only)
  const [countryFilter, setCountryFilter]   = useState<number[]>([]);
  const [provinceFilter, setProvinceFilter] = useState<number[]>([]);
  const [districtFilter, setDistrictFilter] = useState<number[]>([]);
  const [orgFilter, setOrgFilter]           = useState<number[]>([]);

  // Standard LOV options
  const [callTypeOpts, setCallTypeOpts] = useState<LovItem[]>([]);
  const [areaOpts, setAreaOpts] = useState<LovItem[]>([]);
  const [responderOpts, setResponderOpts] = useState<LovItem[]>([]);
  const codeOpts: LovItem[] = COLOUR_ORDER.map((c, i) => ({ id: i, value: c }));

  // Hierarchy options (admin only)
  const [countryOpts, setCountryOpts]   = useState<LovItem[]>([]);
  const [provinceOpts, setProvinceOpts] = useState<LovItem[]>([]);
  const [districtOpts, setDistrictOpts] = useState<LovItem[]>([]);
  const [orgOpts, setOrgOpts]           = useState<LovItem[]>([]);

  useEffect(() => {
    // Load standard LOVs
    Promise.all([
      apiClient.getLov<LovItem[]>('call_types'),
      apiClient.getAreas(),
      apiClient.getLov<LovItem[]>('responders'),
    ]).then(([ct, areas, resp]) => {
      setCallTypeOpts(ct as LovItem[]);
      setAreaOpts(areas as LovItem[]);
      setResponderOpts(resp as LovItem[]);
    }).catch(console.error);

    // Load hierarchy options for admin users
    if (isAdminUser) {
      const countryId = auth?.countryId;
      // Countries — SuperAdmin sees all, CountrySysAdmin doesn't need country filter
      if (isSuperAdmin) {
        apiClient.getCountries(true).then((data) => {
          setCountryOpts((data as HierarchyItem[]).map((c) => ({ id: c.id, value: c.name })));
        }).catch(console.error);
      }
      // Provinces
      apiClient.getProvinces(countryId).then((data) => {
        setProvinceOpts((data as HierarchyItem[]).map((p) => ({ id: p.id, value: p.name })));
      }).catch(console.error);
      // Districts
      apiClient.getDistricts(undefined, countryId).then((data) => {
        setDistrictOpts((data as HierarchyItem[]).map((d) => ({ id: d.id, value: d.name })));
      }).catch(console.error);
      // Organisations
      apiClient.getOrganisations(countryId ? { countryId } : undefined).then((data) => {
        setOrgOpts((data as { id: number; name: string }[]).map((o) => ({ id: o.id, value: o.name })));
      }).catch(console.error);
    }

    load();
  }, []);

  async function load(params?: Record<string, string>) {
    setLoading(true);
    try {
      const data = await apiClient.getIncidents({ limit: '200', ...params });
      setTotal(data.total);
      setIncidents(data.items as Incident[]);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    const params: Record<string, string> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (callTypeFilter.length) params.callTypeId = callTypeFilter.join(',');
    if (areaFilter.length) params.areaId = areaFilter.join(',');
    if (codeFilter.length) params.colourCode = codeFilter.map((i) => COLOUR_ORDER[i]).join(',');
    if (responderFilter.length) params.responderId = responderFilter.join(',');
    // Hierarchy filters
    if (isSuperAdmin && countryFilter.length) params.countryId = countryFilter.join(',');
    if (provinceFilter.length) params.provinceId = provinceFilter.join(',');
    if (districtFilter.length) params.districtId = districtFilter.join(',');
    if (orgFilter.length) params.organisationId = orgFilter.join(',');
    load(params);
  }

  function clearFilters() {
    setFromDate(''); setToDate('');
    setCallTypeFilter([]); setAreaFilter([]); setCodeFilter([]); setResponderFilter([]);
    setCountryFilter([]); setProvinceFilter([]); setDistrictFilter([]); setOrgFilter([]);
    load();
  }

  function handleExportCsv() {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (callTypeFilter.length) params.set('callTypeId', callTypeFilter.join(','));
    if (areaFilter.length) params.set('areaId', areaFilter.join(','));
    if (responderFilter.length) params.set('responderId', responderFilter.join(','));
    if (isSuperAdmin && countryFilter.length) params.set('countryId', countryFilter.join(','));
    if (provinceFilter.length) params.set('provinceId', provinceFilter.join(','));
    if (districtFilter.length) params.set('districtId', districtFilter.join(','));
    if (orgFilter.length) params.set('organisationId', orgFilter.join(','));

    const token = localStorage.getItem('auth_token');
    const qs = params.toString();
    fetch(`/api/incidents/export/csv${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => res.blob()).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incidents-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const hasFilters = fromDate || toDate || callTypeFilter.length || areaFilter.length || codeFilter.length || responderFilter.length
    || countryFilter.length || provinceFilter.length || districtFilter.length || orgFilter.length;

  // Table columns differ for admins (extra "Group" column)
  const tableHeaders = isAdminUser
    ? ['Date', 'Time', 'Group', 'Call Type', 'Diagnosis', 'Area', 'Location', 'Patients', 'Patient Info', 'Code', 'Responders', 'Photos']
    : ['Date', 'Time', 'Call Type', 'Diagnosis', 'Area', 'Location', 'Patients', 'Patient Info', 'Code', 'Responders', 'Photos'];

  return (
    <div>
      {/* Header */}
      <div style={toolbar}>
        <div>
          <h2 style={pageTitle}>Incident History</h2>
          <p style={subtitle}>{total} total incidents</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasFilters && (
            <button style={clearBtn} onClick={clearFilters}>✕ Clear filters</button>
          )}
          <button style={applyBtn} onClick={applyFilters}>Search</button>
          <button style={exportBtn} onClick={handleExportCsv}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div style={filterBar}>
        <div style={dateGroup}>
          <label style={filterLabel}>From</label>
          <input type="date" style={dateInput} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div style={dateGroup}>
          <label style={filterLabel}>To</label>
          <input type="date" style={dateInput} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <MultiSelect label="Call Type" options={callTypeOpts} selected={callTypeFilter} onChange={setCallTypeFilter} />
        <MultiSelect label="Area" options={areaOpts} selected={areaFilter} onChange={setAreaFilter} />
        <MultiSelect label="Code" options={codeOpts} selected={codeFilter} onChange={setCodeFilter} />
        <MultiSelect label="Responder" options={responderOpts} selected={responderFilter} onChange={setResponderFilter} />
        {isAdminUser && (
          <>
            <div style={{ width: 1, backgroundColor: '#e5e7eb', alignSelf: 'stretch', margin: '0 4px' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'center' }}>Scope:</span>
            {isSuperAdmin && (
              <MultiSelect label="Country" options={countryOpts} selected={countryFilter} onChange={setCountryFilter} />
            )}
            <MultiSelect label="Region" options={provinceOpts} selected={provinceFilter} onChange={setProvinceFilter} />
            <MultiSelect label="District" options={districtOpts} selected={districtFilter} onChange={setDistrictFilter} />
            <MultiSelect label="Group" options={orgOpts} selected={orgFilter} onChange={setOrgFilter} />
          </>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 48 }}>Loading...</p>
      ) : incidents.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 48 }}>No incidents found for the selected filters.</p>
      ) : (
        <table style={table}>
          <thead>
            <tr style={thead}>
              {tableHeaders.map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {incidents.map((inc) => {
              const code = worstCode(inc.patients);
              const cStyle = code ? COLOUR_CODE_STYLES[code as keyof typeof COLOUR_CODE_STYLES] : null;
              const d = new Date(inc.incidentDate);
              const diagnoses = inc.patients.map((p) => p.reason?.value).filter(Boolean).join(', ');
              return (
                <tr
                  key={inc.id}
                  style={{ ...tr, cursor: 'pointer' }}
                  onClick={() => setSelected(inc)}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef9f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  <td style={td}>{d.toLocaleDateString('en-ZA')}</td>
                  <td style={td}>{d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                  {isAdminUser && (
                    <td style={td}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{inc.organisation?.name ?? '—'}</div>
                      {inc.organisation?.district && (
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{inc.organisation.district.name}</div>
                      )}
                    </td>
                  )}
                  <td style={td}>{inc.callType?.value ?? '—'}</td>
                  <td style={td}>{diagnoses || '—'}</td>
                  <td style={td}>{inc.location?.area?.value ?? '—'}</td>
                  <td style={td}>{inc.location?.value ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{inc.patientCount}</td>
                  <td style={td}>
                    {inc.patients.map((p) => {
                      const parts = [
                        p.name,
                        p.age != null ? `${p.age}` : null,
                        p.gender ? p.gender[0] : null,
                      ].filter(Boolean);
                      return parts.length ? parts.join(' ') : null;
                    }).filter(Boolean).join(', ') || '—'}
                  </td>
                  <td style={td}>
                    {cStyle && (
                      <span style={{ display: 'inline-block', backgroundColor: cStyle.bg, color: '#fff', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: 12 }}>
                        {cStyle.label}
                      </span>
                    )}
                  </td>
                  <td style={td}>{inc.responders.map((r) => r.responder.value).join(', ')}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{inc.photos.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Detail panel */}
      {selected && <IncidentDetail incident={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const toolbar: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 };
const pageTitle: React.CSSProperties = { fontSize: 24, fontWeight: 700, margin: 0 };
const subtitle: React.CSSProperties = { color: '#6b7280', fontSize: 14, margin: '4px 0 0' };
const filterBar: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16, backgroundColor: '#fff', padding: '14px 16px', borderRadius: 12, border: '1px solid #e5e7eb' };
const filterLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' };
const dateGroup: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
const dateInput: React.CSSProperties = { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '7px 10px', fontSize: 13 };
const applyBtn: React.CSSProperties = { backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600 };
const clearBtn: React.CSSProperties = { backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500 };
const exportBtn: React.CSSProperties = { backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600 };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const thead: React.CSSProperties = { backgroundColor: '#f3f4f6' };
const th: React.CSSProperties = { padding: '11px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };
const tr: React.CSSProperties = { borderBottom: '1px solid #f3f4f6' };
const td: React.CSSProperties = { padding: '11px 12px', fontSize: 13, color: '#111827', verticalAlign: 'middle' };

// Detail panel
const panelOverlay: React.CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', justifyContent: 'flex-end' };
const panel: React.CSSProperties = { width: '100%', maxWidth: 520, height: '100%', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)', overflowY: 'auto' };
const panelHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 20px 16px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0 };
const panelBody: React.CSSProperties = { padding: 16, display: 'flex', flexDirection: 'column', gap: 12 };
const detailCard: React.CSSProperties = { backgroundColor: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' };
const cardHead: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #f3f4f6' };
