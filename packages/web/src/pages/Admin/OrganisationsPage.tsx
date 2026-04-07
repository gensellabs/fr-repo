/**
 * CountrySysAdmin+ — Organisation management + registration approvals
 */
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

interface OrgRow {
  id: number; name: string; isActive: boolean;
  country?: { name: string }; province?: { name: string }; district?: { name: string };
  registeredAt: string; approvedAt?: string;
  _count?: { responders: number; incidents: number };
}

interface RegRow {
  id: number; orgName: string; contactName: string; contactEmail: string;
  contactMobile?: string; status: string; submittedAt: string; reviewNotes?: string;
}

interface SelectItem { id: number; name: string }

type Tab = 'organisations' | 'registrations';

export function OrganisationsPage() {
  const { auth } = useAuth();
  const isSuperAdmin = auth?.role === 'SUPER_ADMIN';

  const [tab, setTab]     = useState<Tab>('organisations');
  const [orgs, setOrgs]   = useState<OrgRow[]>([]);
  const [regs, setRegs]   = useState<RegRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [countries, setCountries]   = useState<SelectItem[]>([]);
  const [provinces, setProvinces]   = useState<SelectItem[]>([]);
  const [districts, setDistricts]   = useState<SelectItem[]>([]);

  const [addMode, setAddMode] = useState(false);
  const [form, setForm]       = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [reviewId, setReviewId]   = useState<number | null>(null);
  const [reviewForm, setReviewForm] = useState<{ status: 'APPROVED' | 'REJECTED'; reviewNotes: string }>({ status: 'APPROVED', reviewNotes: '' });
  const [renameId, setRenameId]   = useState<number | null>(null);
  const [renameName, setRenameName] = useState('');
  const [approvalResult, setApprovalResult] = useState<{ orgName: string; adminName: string; adminEmail: string; tempPassword: string } | null>(null);

  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    apiClient.getCountries().then((d) => setCountries(d as SelectItem[]));
  }, []);

  async function load() {
    setLoading(true);
    try {
      if (tab === 'organisations') setOrgs(await apiClient.getOrganisations({ all: true }) as OrgRow[]);
      if (tab === 'registrations') setRegs(await apiClient.getOrgRegistrations() as RegRow[]);
    } finally { setLoading(false); }
  }

  async function loadProvinces(countryId: number) {
    const data = await apiClient.getProvinces(countryId) as SelectItem[];
    setProvinces(data);
  }
  async function loadDistricts(provinceId: number) {
    const data = await apiClient.getDistricts(provinceId) as SelectItem[];
    setDistricts(data);
  }

  async function handleAdd() {
    setSaving(true);
    try {
      await apiClient.createOrganisation({ ...form, countryId: Number(form.countryId), provinceId: Number(form.provinceId), districtId: Number(form.districtId) });
      setAddMode(false); setForm({});
      load();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggle(id: number, isActive: boolean) {
    try {
      await apiClient.updateOrganisation(id, { isActive: !isActive });
      load();
    } catch (e: unknown) { alert((e as Error).message); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Permanently delete organisation "${name}"?\n\nAll responders must be moved or deleted first. Organisations with incident records cannot be deleted — deactivate instead.`)) return;
    try {
      await apiClient.deleteOrganisation(id);
      load();
    } catch (e: unknown) { alert((e as Error).message); }
  }

  async function handleRename() {
    if (!renameId || !renameName.trim()) return;
    setSaving(true);
    try {
      await apiClient.updateOrganisation(renameId, { name: renameName.trim() });
      setRenameId(null);
      load();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleReview() {
    if (!reviewId) return;
    setSaving(true);
    try {
      const result = await apiClient.reviewOrgRegistration(reviewId, reviewForm) as {
        registration: RegRow;
        organisation?: { name: string };
        groupSysAdmin?: { value: string; email: string };
        tempPassword?: string;
      };
      setReviewId(null);
      if (reviewForm.status === 'APPROVED' && result.tempPassword && result.groupSysAdmin && result.organisation) {
        setApprovalResult({
          orgName: result.organisation.name,
          adminName: result.groupSysAdmin.value,
          adminEmail: result.groupSysAdmin.email,
          tempPassword: result.tempPassword,
        });
      }
      load();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSaving(false); }
  }

  const pendingCount = regs.filter((r) => r.status === 'PENDING').length;

  return (
    <div>
      <div style={toolbar}>
        <div>
          <h2 style={pageTitle}>Organisations</h2>
          <p style={subtitle}>Manage registered first responder groups.</p>
        </div>
        {tab === 'organisations' && <button style={addBtn} onClick={() => { setAddMode(true); setForm({}); }}>+ Add Organisation</button>}
      </div>

      <div style={tabs}>
        <button onClick={() => setTab('organisations')} style={{ ...tabBtn, ...(tab === 'organisations' ? tabActive : {}) }}>
          Organisations ({orgs.length})
        </button>
        <button onClick={() => setTab('registrations')} style={{ ...tabBtn, ...(tab === 'registrations' ? tabActive : {}) }}>
          Registration Requests {pendingCount > 0 && <span style={badge}>{pendingCount}</span>}
        </button>
      </div>

      {/* Add form */}
      {addMode && tab === 'organisations' && (
        <div style={formBox}>
          <input placeholder="Organisation name (max 40 chars)" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inp, minWidth: 260 }} maxLength={40} />
          <select value={form.countryId ?? ''} onChange={(e) => { setForm({ ...form, countryId: e.target.value, provinceId: '', districtId: '' }); loadProvinces(Number(e.target.value)); }} style={inp}>
            <option value="">— Country —</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={form.provinceId ?? ''} onChange={(e) => { setForm({ ...form, provinceId: e.target.value, districtId: '' }); loadDistricts(Number(e.target.value)); }} style={inp} disabled={!form.countryId}>
            <option value="">— Province —</option>
            {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={form.districtId ?? ''} onChange={(e) => setForm({ ...form, districtId: e.target.value })} style={inp} disabled={!form.provinceId}>
            <option value="">— District —</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button style={saveBtn} onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
          <button style={cancelBtn} onClick={() => setAddMode(false)}>Cancel</button>
        </div>
      )}

      {/* Rename modal */}
      {renameId !== null && (
        <div style={modal}>
          <div style={modalCard}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Rename Organisation</h3>
            <input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              style={{ ...inp, width: '100%', boxSizing: 'border-box' }}
              maxLength={40}
              placeholder="Organisation name (max 40 chars)"
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button style={saveBtn} onClick={handleRename} disabled={saving || !renameName.trim()}>{saving ? 'Saving…' : 'Save'}</button>
              <button style={cancelBtn} onClick={() => setRenameId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Approval result modal — shown once after approving a registration */}
      {approvalResult && (
        <div style={modal}>
          <div style={modalCard}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Organisation Approved</h3>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              <strong>{approvalResult.orgName}</strong> has been created. A GROUP_SYSADMIN account was set up for the contact person.
              Share these credentials securely — this password will not be shown again.
            </p>
            <div style={{ backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', padding: 14, fontSize: 14, lineHeight: 1.8 }}>
              <div><span style={{ color: '#6b7280' }}>Name:</span> <strong>{approvalResult.adminName}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Email:</span> <strong>{approvalResult.adminEmail}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Temp password:</span>{' '}
                <code style={{ backgroundColor: '#fef3c7', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
                  {approvalResult.tempPassword}
                </code>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>The GROUP_SYSADMIN can change their password after first login via the Responder LOV settings.</p>
            <button style={{ ...saveBtn, marginTop: 16, width: '100%' }} onClick={() => setApprovalResult(null)}>Done</button>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewId !== null && (
        <div style={modal}>
          <div style={modalCard}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Review Registration</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <button style={{ ...tabBtn, ...(reviewForm.status === 'APPROVED' ? { backgroundColor: '#16a34a', color: '#fff', borderColor: '#16a34a' } : {}) }} onClick={() => setReviewForm({ ...reviewForm, status: 'APPROVED' })}>✓ Approve</button>
              <button style={{ ...tabBtn, ...(reviewForm.status === 'REJECTED' ? { backgroundColor: '#dc2626', color: '#fff', borderColor: '#dc2626' } : {}) }} onClick={() => setReviewForm({ ...reviewForm, status: 'REJECTED' })}>✕ Reject</button>
            </div>
            <textarea placeholder="Notes (optional)" value={reviewForm.reviewNotes} onChange={(e) => setReviewForm({ ...reviewForm, reviewNotes: e.target.value })} style={{ ...inp, width: '100%', minHeight: 80, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button style={saveBtn} onClick={handleReview} disabled={saving}>{saving ? 'Saving…' : 'Submit'}</button>
              <button style={cancelBtn} onClick={() => setReviewId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 40 }}>Loading…</p>
      ) : tab === 'organisations' ? (
        <table style={table}>
          <thead>
            <tr style={thead}>
              <th style={th}>Organisation</th>
              <th style={th}>Location</th>
              <th style={{ ...th, textAlign: 'center' }}>Responders</th>
              <th style={{ ...th, textAlign: 'center' }}>Incidents</th>
              <th style={{ ...th, textAlign: 'center' }}>Active</th>
              {isSuperAdmin && <th style={{ ...th, textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} style={tr}>
                <td style={td}><span style={{ fontWeight: 600 }}>{org.name}</span></td>
                <td style={td}>{[org.country?.name, org.province?.name, org.district?.name].filter(Boolean).join(' › ')}</td>
                <td style={{ ...td, textAlign: 'center' }}>{org._count?.responders ?? 0}</td>
                <td style={{ ...td, textAlign: 'center' }}>{org._count?.incidents ?? 0}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ ...statusDot, backgroundColor: org.isActive ? '#16a34a' : '#d1d5db' }} />
                </td>
                {isSuperAdmin && (
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button style={{ ...editBtn, marginRight: 6 }} onClick={() => { setRenameId(org.id); setRenameName(org.name); }}>Rename</button>
                    <button style={{ ...editBtn, marginRight: 6, color: org.isActive ? '#dc2626' : '#16a34a' }} onClick={() => handleToggle(org.id, org.isActive)}>
                      {org.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button style={{ ...editBtn, color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDelete(org.id, org.name)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table style={table}>
          <thead>
            <tr style={thead}>
              <th style={th}>Org Name</th>
              <th style={th}>Contact</th>
              <th style={th}>Submitted</th>
              <th style={{ ...th, textAlign: 'center' }}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {regs.map((reg) => (
              <tr key={reg.id} style={tr}>
                <td style={td}><span style={{ fontWeight: 600 }}>{reg.orgName}</span></td>
                <td style={td}>
                  <div>{reg.contactName}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{reg.contactEmail}</div>
                  {reg.contactMobile && <div style={{ fontSize: 12, color: '#6b7280' }}>{reg.contactMobile}</div>}
                </td>
                <td style={td}>{new Date(reg.submittedAt).toLocaleDateString('en-ZA')}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ ...statusPill, backgroundColor: reg.status === 'PENDING' ? '#fef3c7' : reg.status === 'APPROVED' ? '#dcfce7' : '#fef2f2', color: reg.status === 'PENDING' ? '#92400e' : reg.status === 'APPROVED' ? '#16a34a' : '#dc2626' }}>
                    {reg.status}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {reg.status === 'PENDING' && (
                    <button style={editBtn} onClick={() => { setReviewId(reg.id); setReviewForm({ status: 'APPROVED', reviewNotes: '' }); }}>
                      Review
                    </button>
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

const toolbar: React.CSSProperties   = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 };
const pageTitle: React.CSSProperties = { fontSize: 24, fontWeight: 700 };
const subtitle: React.CSSProperties  = { color: '#6b7280', fontSize: 14 };
const tabs: React.CSSProperties      = { display: 'flex', gap: 8, marginBottom: 16 };
const tabBtn: React.CSSProperties    = { padding: '8px 18px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 };
const tabActive: React.CSSProperties = { backgroundColor: '#dc2626', color: '#fff', borderColor: '#dc2626' };
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
const statusPill: React.CSSProperties = { fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '3px 10px' };
const badge: React.CSSProperties     = { display: 'inline-block', marginLeft: 6, backgroundColor: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 12, fontWeight: 700 };
const modal: React.CSSProperties     = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modalCard: React.CSSProperties = { backgroundColor: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
