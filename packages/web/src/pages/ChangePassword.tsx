import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';

// Password rule definitions — kept in one place for display + validation parity
const RULES = [
  { label: 'At least 12 characters',                    test: (p: string) => p.length >= 12 },
  { label: 'At least one uppercase letter (A–Z)',        test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least one lowercase letter (a–z)',        test: (p: string) => /[a-z]/.test(p) },
  { label: 'At least one digit (0–9)',                   test: (p: string) => /[0-9]/.test(p) },
  { label: 'At least one special character (@, #, &, %, !)', test: (p: string) => /[@#&%!]/.test(p) },
];

export function ChangePassword() {
  const { clearMustChangePassword } = useAuth();

  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);

  const allRulesPassed = RULES.every((r) => r.test(newPwd));
  const passwordsMatch = newPwd === confirmPwd && confirmPwd.length > 0;
  const canSubmit = currentPwd && allRulesPassed && passwordsMatch && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await apiClient.changePassword(currentPwd, newPwd);
      setSuccess(true);
      clearMustChangePassword();
      // Brief pause to show success message, then redirect
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={title}>🚨 FirstResponders</h1>
        <h2 style={heading}>Set Your Password</h2>
        <p style={sub}>
          Your password must be changed before you can continue.
          Please choose a secure password you haven't used before.
        </p>

        {success ? (
          <div style={successBox}>✅ Password changed successfully. Redirecting…</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Current password */}
            <div>
              <label style={label}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={input}
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPwd}
                  onChange={(e) => { setCurrentPwd(e.target.value); setError(''); }}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button type="button" style={eyeBtn} tabIndex={-1} onClick={() => setShowCurrent((v) => !v)}>
                  {showCurrent ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label style={label}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={input}
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={(e) => { setNewPwd(e.target.value); setError(''); }}
                  placeholder="Choose a strong password"
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button type="button" style={eyeBtn} tabIndex={-1} onClick={() => setShowNew((v) => !v)}>
                  {showNew ? '🙈' : '👁'}
                </button>
              </div>

              {/* Live rule checklist */}
              {newPwd.length > 0 && (
                <ul style={ruleList}>
                  {RULES.map((r) => {
                    const ok = r.test(newPwd);
                    return (
                      <li key={r.label} style={{ ...ruleItem, color: ok ? '#16a34a' : '#dc2626' }}>
                        {ok ? '✓' : '✗'} {r.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={label}>Confirm New Password</label>
              <input
                style={{
                  ...input,
                  borderColor: confirmPwd.length > 0
                    ? (passwordsMatch ? '#16a34a' : '#dc2626')
                    : '#d1d5db',
                }}
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                disabled={loading}
              />
              {confirmPwd.length > 0 && !passwordsMatch && (
                <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>Passwords do not match</p>
              )}
            </div>

            {error && <div style={errorBox}>⚠ {error}</div>}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{ ...btn, opacity: canSubmit ? 1 : 0.45 }}
            >
              {loading ? 'Saving…' : 'Set Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const page: React.CSSProperties    = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#dc2626' };
const card: React.CSSProperties    = { backgroundColor: '#fff', borderRadius: 20, padding: 36, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const title: React.CSSProperties   = { fontSize: 26, fontWeight: 800, color: '#dc2626', textAlign: 'center', marginBottom: 4 };
const heading: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#111827', textAlign: 'center', marginBottom: 6 };
const sub: React.CSSProperties     = { color: '#6b7280', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 };
const label: React.CSSProperties   = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };
const input: React.CSSProperties   = { width: '100%', padding: '11px 44px 11px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 15, outline: 'none', boxSizing: 'border-box' };
const btn: React.CSSProperties     = { width: '100%', padding: '13px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 4 };
const errorBox: React.CSSProperties  = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 };
const successBox: React.CSSProperties = { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '16px', color: '#15803d', fontSize: 14, textAlign: 'center' };
const eyeBtn: React.CSSProperties  = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 };
const ruleList: React.CSSProperties = { listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 3 };
const ruleItem: React.CSSProperties = { fontSize: 12, fontWeight: 500 };
