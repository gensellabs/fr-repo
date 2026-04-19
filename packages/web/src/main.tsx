import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { AdminLogin } from './pages/AdminLogin';
import { IncidentNew } from './pages/IncidentNew';
import { History } from './pages/History';
import { AdminLayout } from './pages/Admin/AdminLayout';
import { LovTablePage } from './pages/Admin/LovTablePage';
import { LocationsPage } from './pages/Admin/LocationsPage';
import { AuditPage } from './pages/Admin/AuditPage';
import { StatsPage } from './pages/Admin/StatsPage';
import { UserManagementPage } from './pages/Admin/UserManagementPage';
import { HierarchyPage } from './pages/Admin/HierarchyPage';
import { OrganisationsPage } from './pages/Admin/OrganisationsPage';
import { AdminUsersPage } from './pages/Admin/AdminUsersPage';
import { RegisterOrg } from './pages/RegisterOrg';
import { AppLayout } from './components/AppLayout';
import { useAuth } from './hooks/useAuth';

function App() {
  const { auth } = useAuth();

  if (!auth) {
    return (
      <Routes>
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/register-org" element={<RegisterOrg />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const isSuperAdmin      = auth.role === 'SUPER_ADMIN';
  const isCountrySysAdmin = auth.role === 'COUNTRY_SYSADMIN' || isSuperAdmin;
  const isGroupSysAdmin   = auth.isSysAdmin || isCountrySysAdmin;

  // Any user who authenticated via email+password goes to the admin-only panel
  const isWebAdminLogin = auth.loginMethod === 'admin' || (!!auth.adminUserId && !auth.responderId);

  if (isWebAdminLogin) {
    return (
      <AppLayout auth={auth}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/history" element={<History />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/lovs/call_types" replace />} />
            <Route path="lovs/:table" element={<LovTablePage />} />
            <Route path="locations"   element={<LocationsPage />} />
            <Route path="audit"       element={<AuditPage />} />
            <Route path="stats"       element={<StatsPage />} />
            {isGroupSysAdmin    && <Route path="users"        element={<UserManagementPage />} />}
            {isGroupSysAdmin    && <Route path="hierarchy"    element={<HierarchyPage />} />}
            {isCountrySysAdmin  && <Route path="organisations" element={<OrganisationsPage />} />}
            {isSuperAdmin       && <Route path="admin-users"  element={<AdminUsersPage />} />}
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AppLayout>
    );
  }

  return (
    <AppLayout auth={auth}>
      <Routes>
        <Route path="/" element={<Navigate to="/incident/new" replace />} />
        <Route path="/incident/new" element={<IncidentNew />} />
        <Route path="/history" element={<History />} />
        {auth.isAdmin && (
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/lovs/call_types" replace />} />
            <Route path="lovs/:table" element={<LovTablePage />} />
            <Route path="locations"   element={<LocationsPage />} />
            <Route path="audit"       element={<AuditPage />} />
            <Route path="stats"       element={<StatsPage />} />
            {isGroupSysAdmin    && <Route path="users"         element={<UserManagementPage />} />}
            {isGroupSysAdmin    && <Route path="hierarchy"     element={<HierarchyPage />} />}
            {isCountrySysAdmin  && <Route path="organisations" element={<OrganisationsPage />} />}
            {isSuperAdmin       && <Route path="admin-users"   element={<AdminUsersPage />} />}
          </Route>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
