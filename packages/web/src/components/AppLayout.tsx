import React, { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthState, useAuth } from '../hooks/useAuth';

interface Props { children: ReactNode; auth: AuthState; }

export function AppLayout({ children, auth }: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={hdr}>
        <span style={logo}>
          🚨 FirstResponders
          {auth.organisationName && (
            <span style={logoOrg}> — {auth.organisationName}</span>
          )}
        </span>
        <nav style={nav}>
          {auth.responderId && <NavLink to="/incident/new" style={navLink}>New Incident</NavLink>}
          {(auth.responderId || auth.isAdmin) && <NavLink to="/history" style={navLink}>History</NavLink>}
          {auth.isAdmin && <NavLink to="/admin" style={navLink}>Admin</NavLink>}
        </nav>
        <div style={user}>
          <div>
            <span style={userName}>{auth.adminName ?? auth.responderName}</span>
            {auth.countryName && <span style={{ display: 'block', fontSize: 11, color: '#fca5a5' }}>{auth.countryName}</span>}
          </div>
          {auth.role === 'SUPER_ADMIN'      && <span style={superAdminBadge}>SUPERADMIN</span>}
          {auth.role === 'COUNTRY_SYSADMIN' && <span style={sysAdminBadge}>COUNTRY ADMIN</span>}
          {auth.role === 'GROUP_SYSADMIN'   && <span style={sysAdminBadge}>SYSADMIN</span>}
          {auth.role === 'GROUP_ADMIN'      && <span style={adminBadge}>ADMIN</span>}
          <button style={logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </header>
      <main style={main}>{children}</main>
    </div>
  );
}

const navLink = ({ isActive }: { isActive: boolean }) => ({
  color: isActive ? '#fff' : '#fca5a5',
  textDecoration: 'none',
  fontWeight: isActive ? '700' : '500',
  fontSize: 14,
  padding: '4px 0',
  borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
} as React.CSSProperties);

const hdr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#dc2626', color: '#fff', padding: '0 24px', height: 56, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' };
const logo: React.CSSProperties = { fontWeight: 800, fontSize: 18, letterSpacing: -0.3 };
const logoOrg: React.CSSProperties = { fontWeight: 400, fontSize: 15, letterSpacing: 0 };
const nav: React.CSSProperties = { display: 'flex', gap: 24 };
const user: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const userName: React.CSSProperties = { fontSize: 14, fontWeight: 600 };
const adminBadge: React.CSSProperties      = { fontSize: 11, fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 6px' };
const sysAdminBadge: React.CSSProperties   = { fontSize: 11, fontWeight: 700, backgroundColor: '#7c3aed', borderRadius: 4, padding: '2px 6px' };
const superAdminBadge: React.CSSProperties = { fontSize: 11, fontWeight: 700, backgroundColor: '#1e293b', borderRadius: 4, padding: '2px 6px' };
const logoutBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const main: React.CSSProperties = { flex: 1, padding: '20px 16px', maxWidth: 1600, margin: '0 auto', width: '100%' };
