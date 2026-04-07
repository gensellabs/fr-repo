import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

interface SelectItem { id: number; name: string }

type Step = 'form' | 'success';

export function RegisterOrg() {
  const [step, setStep] = useState<Step>('form');

  const [countries, setCountries] = useState<SelectItem[]>([]);
  const [provinces, setProvinces] = useState<SelectItem[]>([]);
  const [districts, setDistricts] = useState<SelectItem[]>([]);

  const [orgName, setOrgName]             = useState('');
  const [contactName, setContactName]     = useState('');
  const [contactEmail, setContactEmail]   = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [countryId, setCountryId]         = useState('');
  const [provinceId, setProvinceId]       = useState('');
  const [districtId, setDistrictId]       = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    apiClient.getCountries().then((d) => setCountries(d as SelectItem[]));
  }, []);

  async function onCountryChange(id: string) {
    setCountryId(id);
    setProvinceId('');
    setDistrictId('');
    setProvinces([]);
    setDistricts([]);
    if (id) {
      const data = await apiClient.getProvinces(Number(id)) as SelectItem[];
      setProvinces(data);
    }
  }

  async function onProvinceChange(id: string) {
    setProvinceId(id);
    setDistrictId('');
    setDistricts([]);
    if (id) {
      const data = await apiClient.getDistricts(Number(id)) as SelectItem[];
      setDistricts(data);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!orgName.trim() || !contactName.trim() || !contactEmail.trim() || !countryId || !provinceId || !districtId) {
      setError('Please fill in all required fields.');
      return;
    }
    if (orgName.trim().length > 40) {
      setError('Organisation name must be 40 characters or fewer.');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.submitOrgRegistration({
        orgName: orgName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactMobile: contactMobile.trim() || undefined,
        countryId: Number(countryId),
        provinceId: Number(provinceId),
        districtId: Number(districtId),
      });
      setStep('success');
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'success') {
    return (
      <div style={page}>
        <div style={card}>
          <h1 style={title}>🚨 FirstResponders</h1>
          <div style={successBox}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Registration Submitted</h2>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
              Your registration for <strong>{orgName}</strong> has been submitted successfully.
              A country administrator will review your request and contact you at <strong>{contactEmail}</strong>.
            </p>
          </div>
          <p style={{ textAlign: 'center', marginTop: 20 }}>
            <a href="/admin-login" style={link}>← Back to Admin Login</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={{ ...card, maxWidth: 480 }}>
        <h1 style={title}>🚨 FirstResponders</h1>
        <p style={subtitle}>Register Your Organisation</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>Organisation Name <span style={req}>*</span></label>
            <input style={input} maxLength={40} placeholder="e.g. Franschhoek First Responders" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <span style={hint}>{orgName.length}/40</span>
          </div>

          <div>
            <label style={label}>Contact Person <span style={req}>*</span></label>
            <input style={input} placeholder="Full name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>

          <div>
            <label style={label}>Contact Email <span style={req}>*</span></label>
            <input style={input} type="email" placeholder="admin@yourorg.org" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>

          <div>
            <label style={label}>Contact Mobile <span style={optLabel}>(optional)</span></label>
            <input style={input} type="tel" placeholder="+27821234567" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)} />
          </div>

          <div style={divider} />

          <div>
            <label style={label}>Country <span style={req}>*</span></label>
            <select style={input} value={countryId} onChange={(e) => onCountryChange(e.target.value)}>
              <option value="">— Select country —</option>
              {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label style={label}>Province <span style={req}>*</span></label>
            <select style={input} value={provinceId} onChange={(e) => onProvinceChange(e.target.value)} disabled={!countryId}>
              <option value="">— Select province —</option>
              {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label style={label}>District <span style={req}>*</span></label>
            <select style={input} value={districtId} onChange={(e) => setDistrictId(e.target.value)} disabled={!provinceId}>
              <option value="">— Select district —</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {error && <div style={errorBox}>{error}</div>}

          <button type="submit" disabled={submitting} style={btn}>
            {submitting ? 'Submitting…' : 'Submit Registration'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/admin-login" style={link}>← Back to Admin Login</a>
        </p>
      </div>
    </div>
  );
}

const page: React.CSSProperties      = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', padding: '32px 16px' };
const card: React.CSSProperties      = { backgroundColor: '#fff', borderRadius: 20, padding: 36, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' };
const title: React.CSSProperties     = { fontSize: 26, fontWeight: 800, color: '#dc2626', textAlign: 'center', marginBottom: 4 };
const subtitle: React.CSSProperties  = { textAlign: 'center', color: '#6b7280', marginBottom: 24, fontSize: 15 };
const label: React.CSSProperties     = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 };
const input: React.CSSProperties     = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const hint: React.CSSProperties      = { fontSize: 11, color: '#9ca3af', float: 'right', marginTop: 3 };
const req: React.CSSProperties       = { color: '#dc2626' };
const optLabel: React.CSSProperties  = { fontSize: 11, color: '#9ca3af', fontWeight: 400 };
const divider: React.CSSProperties   = { borderTop: '1px solid #e5e7eb', margin: '4px 0' };
const btn: React.CSSProperties       = { width: '100%', padding: '12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 4 };
const errorBox: React.CSSProperties  = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14 };
const successBox: React.CSSProperties = { backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 24, textAlign: 'center', color: '#15803d' };
const link: React.CSSProperties      = { color: '#dc2626', textDecoration: 'none', fontSize: 14 };
