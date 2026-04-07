import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) { setError('Please enter your username'); return; }
    if (pin.length !== 4)  { setError('PIN must be exactly 4 digits'); return; }

    setLoading(true);
    setError('');
    try {
      await login(username.trim().toLowerCase(), pin);
      window.location.href = '/';
    } catch {
      setError('Invalid username or PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={title}>🚨 FirstResponders</h1>
        <p style={subtitle}>Sign in with your username and PIN</p>
        <p style={{ textAlign: 'right', marginBottom: 20, marginTop: -8 }}>
          <a href="/admin-login" style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none' }}>Admin login →</a>
        </p>

        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              style={inputStyle}
              placeholder="e.g. elszaf774"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              autoCapitalize="none"
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div>
            <label style={labelStyle}>
              PIN <span style={{ color: '#9ca3af', fontSize: 12, fontWeight: 400 }}>(last 4 digits of your mobile)</span>
            </label>
            <input
              style={{ ...inputStyle, letterSpacing: 12, fontSize: 22, textAlign: 'center' }}
              type="password"
              inputMode="numeric"
              placeholder="••••"
              maxLength={4}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && <p style={errorStyle}>{error}</p>}

          <button
            type="submit"
            style={{ ...btn, opacity: (loading || !username.trim() || pin.length !== 4) ? 0.5 : 1 }}
            disabled={loading || !username.trim() || pin.length !== 4}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={helpText}>
          Your username and PIN were provided by your group administrator.
        </p>
      </div>
    </div>
  );
}

const page: React.CSSProperties      = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#dc2626' };
const card: React.CSSProperties      = { backgroundColor: '#fff', borderRadius: 20, padding: 36, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const title: React.CSSProperties     = { fontSize: 28, fontWeight: 800, color: '#dc2626', textAlign: 'center', marginBottom: 6 };
const subtitle: React.CSSProperties  = { textAlign: 'center', color: '#6b7280', marginBottom: 20 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 10, padding: '12px 14px', fontSize: 16, boxSizing: 'border-box', outline: 'none' };
const btn: React.CSSProperties       = { backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%' };
const errorStyle: React.CSSProperties = { color: '#dc2626', fontSize: 13, textAlign: 'center', margin: 0 };
const helpText: React.CSSProperties  = { color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 20 };
