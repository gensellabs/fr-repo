import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const LOV_TABLES = [
  { key: 'call_types',              label: 'Call Types' },
  { key: 'reasons',                 label: 'Diagnoses' },
  { key: 'transports',              label: 'Transports' },
  { key: 'hospitals',               label: 'Hospitals' },
  { key: 'responders',              label: 'Responders' },
  { key: 'medical_history_presets', label: 'Medical History Presets' },
  { key: 'drugs',                   label: 'Drugs' },
];

export function AdminLayout() {
  const { auth } = useAuth();

  const isSuperAdmin       = auth?.role === 'SUPER_ADMIN';
  const isCountrySysAdmin  = auth?.role === 'COUNTRY_SYSADMIN' || isSuperAdmin;
  const isGroupSysAdmin    = auth?.isSysAdmin || isCountrySysAdmin;

  const navLink = ({ isActive }: { isActive: boolean }) => ({
    display: 'block',
    padding: '8px 12px',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: isActive ? '600' : '400',
    color: isActive ? '#dc2626' : '#374151',
    backgroundColor: isActive ? '#fef2f2' : 'transparent',
  } as React.CSSProperties);

  return (
    <div style={layout}>
      <aside style={sidebar}>

        {/* ── Group Level LOVs ── */}
        <p style={sidebarTitle}>LOV Tables</p>
        {LOV_TABLES.map((t) => (
          <NavLink key={t.key} to={`/admin/lovs/${t.key}`} style={navLink}>{t.label}</NavLink>
        ))}

        <p style={{ ...sidebarTitle, marginTop: 20 }}>Special</p>
        <NavLink to="/admin/locations" style={navLink}>Location Hierarchy</NavLink>

        <p style={{ ...sidebarTitle, marginTop: 20 }}>Reports</p>
        <NavLink to="/admin/stats" style={navLink}>Statistics</NavLink>
        <NavLink to="/admin/audit" style={navLink}>Audit Log</NavLink>

        {/* ── Group SysAdmin ── */}
        {isGroupSysAdmin && (
          <>
            <p style={{ ...sidebarTitle, marginTop: 20 }}>Group SysAdmin</p>
            <NavLink to="/admin/users" style={navLink}>Responder Roles</NavLink>
          </>
        )}

        {/* ── Country SysAdmin ── */}
        {isCountrySysAdmin && (
          <>
            <p style={{ ...sidebarTitle, marginTop: 20 }}>Country SysAdmin</p>
            <NavLink to="/admin/organisations" style={navLink}>Organisations</NavLink>
            <NavLink to="/admin/hierarchy"     style={navLink}>Geographic Hierarchy</NavLink>
          </>
        )}

        {/* ── Super Admin ── */}
        {isSuperAdmin && (
          <>
            <p style={{ ...sidebarTitle, marginTop: 20 }}>Super Admin</p>
            <NavLink to="/admin/admin-users" style={navLink}>Admin Users</NavLink>
          </>
        )}

        {/* Role indicator */}
        <div style={roleBox}>
          {auth?.adminName ? (
            <>
              <span style={roleDot} />
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {auth.role?.replace(/_/g, ' ')}<br />
                <span style={{ color: '#9ca3af' }}>{auth.countryName ?? 'Global'}</span>
              </span>
            </>
          ) : (
            <>
              <span style={{ ...roleDot, backgroundColor: '#6b7280' }} />
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {auth?.role?.replace(/_/g, ' ')}<br />
                <span style={{ color: '#9ca3af' }}>{auth?.organisationName}</span>
              </span>
            </>
          )}
        </div>
      </aside>

      <div style={content}><Outlet /></div>
    </div>
  );
}

const layout: React.CSSProperties      = { display: 'flex', gap: 24, alignItems: 'flex-start' };
const sidebar: React.CSSProperties     = { width: 220, flexShrink: 0, backgroundColor: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', position: 'sticky', top: 80 };
const sidebarTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 4 };
const content: React.CSSProperties     = { flex: 1, minWidth: 0 };
const roleBox: React.CSSProperties     = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, padding: '8px 10px', backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #f3f4f6' };
const roleDot: React.CSSProperties     = { width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626', flexShrink: 0 };
