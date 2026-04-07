import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function AdminLogin() {
  const { adminLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminLogin(email.trim(), password);
      window.location.href = '/';
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={title}>🚨 FirstResponders</h1>
        <p style={subtitle}>Admin Portal Login</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              style={input}
              autoComplete="email"
            />
          </div>
          <div>
            <label style={label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={input}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={errorBox}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={btn}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={backLink}>
          <a href="/" style={{ color: '#dc2626', textDecoration: 'none', fontSize: 14 }}>
            ← Back to Responder Login
          </a>
        </p>
        <p style={{ ...backLink, marginTop: 10 }}>
          <a href="/register-org" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13 }}>
            Register your organisation →
          </a>
        </p>
      </div>
    </div>
  );
}

const page: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' };
const card: React.CSSProperties = { backgroundColor: '#fff', borderRadius: 20, padding: 36, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' };
const title: React.CSSProperties = { fontSize: 26, fontWeight: 800, color: '#dc2626', textAlign: 'center', marginBottom: 4 };
const subtitle: React.CSSProperties = { textAlign: 'center', color: '#6b7280', marginBottom: 28, fontSize: 15 };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 15, outline: 'none', boxSizing: 'border-box' };
const btn: React.CSSProperties = { width: '100%', padding: '12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 4 };
const errorBox: React.CSSProperties = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14 };
const backLink: React.CSSProperties = { textAlign: 'center', marginTop: 20, marginBottom: 0 };
