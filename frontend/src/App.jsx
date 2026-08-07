import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

// Actions & Thunks
import {
  setView,
  setActiveTab,
  setErrorMsg,
  setSuccessMsg,
  logout
} from './store/slices/authSlice';

import {
  fetchProperties
} from './store/slices/propertySlice';

import {
  fetchTenants,
  fetchInquiries
} from './store/slices/tenantSlice';

import {
  fetchBillingPlans
} from './store/slices/billingSlice';

import {
  fetchMaintenanceComplaints
} from './store/slices/maintenanceSlice';

import {
  fetchSecurityInformation
} from './store/slices/securitySlice';

import {
  fetchAdminDetails
} from './store/slices/adminSlice';

import { api } from './services/api';

// Panels
import Login from './pages/Login';
import Register from './pages/Register';
import HomeDashboard from './components/HomeDashboard';
import PropertyPanel from './components/PropertyPanel';
import RoomPanel from './components/RoomPanel';
import TenantPanel from './components/TenantPanel';
import BillingPanel from './components/BillingPanel';
import MaintenancePanel from './components/MaintenancePanel';
import SecurityPanel from './components/SecurityPanel';
import AdminPanel from './components/AdminPanel';

function App() {
  const dispatch = useDispatch();

  // Select state from Redux
  const { user, view, activeTab, errorMsg, successMsg } = useSelector(state => state.auth);
  const { properties } = useSelector(state => state.property);
  const { tenants, inquiries } = useSelector(state => state.tenant);
  const { billingPlans } = useSelector(state => state.billing);
  const { allComplaints } = useSelector(state => state.maintenance);
  
  // Security & Admin Configurations Selector
  const { allVisitors, allParcels, allIncidents } = useSelector(state => state.security);
  const { sysSmsProvider, sysEmailProvider, sysAllowSelfReg, sysMaintMode, notificationLogs, auditLogs } = useSelector(state => state.admin);

  const token = user?.accessToken;

  // Central loaders triggered by Redux Thunks
  const loadProperties = () => {
    if (token) dispatch(fetchProperties(token));
  };

  const loadTenants = () => {
    if (token) dispatch(fetchTenants(token));
  };

  const loadInquiries = () => {
    if (token) dispatch(fetchInquiries(token));
  };

  const loadBillingPlans = () => {
    if (token) dispatch(fetchBillingPlans(token));
  };

  const loadMaintenanceComplaints = () => {
    if (token && tenants.length > 0) {
      dispatch(fetchMaintenanceComplaints({ token, tenants }));
    }
  };

  const loadSecurityInformation = () => {
    if (token && tenants.length > 0) {
      dispatch(fetchSecurityInformation({ token, tenants }));
    }
  };

  const loadAdminDetails = () => {
    if (token) dispatch(fetchAdminDetails(token));
  };

  const roles = user?.roles || [];
  const hasRole = (r) => roles.includes(r);

  const getMenuItems = () => {
    const items = [{ id: 'home', label: '🏠 Home Dashboard' }];
    const isSuperAdminOrOwner = hasRole('ROLE_SUPER_ADMIN') || hasRole('ROLE_OWNER');

    if (isSuperAdminOrOwner || hasRole('ROLE_PROPERTY_MANAGER') || hasRole('ROLE_RECEPTIONIST')) {
      items.push({ id: 'properties', label: '🏢 Properties & Buildings' });
      items.push({ id: 'rooms', label: '🛏️ Rooms & Beds' });
      items.push({ id: 'tenants', label: '👤 Tenants & Audits' });
    }

    if (isSuperAdminOrOwner || hasRole('ROLE_ACCOUNTANT')) {
      items.push({ id: 'invoices', label: '💵 Rent & Invoices' });
    }

    if (isSuperAdminOrOwner || hasRole('ROLE_PROPERTY_MANAGER') || hasRole('ROLE_STAFF') || hasRole('ROLE_TENANT')) {
      items.push({ id: 'maintenance', label: '🛠️ Maintenance Tasks' });
    }

    if (isSuperAdminOrOwner || hasRole('ROLE_PROPERTY_MANAGER') || hasRole('ROLE_SECURITY_GUARD')) {
      items.push({ id: 'security', label: '🚧 Security & Visitors' });
    }

    if (hasRole('ROLE_SUPER_ADMIN')) {
      items.push({ id: 'admin', label: '⚙️ Admin Console' });
    }
    return items;
  };

  const menuItems = getMenuItems();

  useEffect(() => {
    if (view === 'dashboard' && menuItems.length > 0) {
      const allowed = menuItems.some(i => i.id === activeTab);
      if (!allowed) {
        dispatch(setActiveTab(menuItems[0].id));
      }
    }
  }, [view, activeTab, user]);

  useEffect(() => {
    if (view === 'dashboard' && token) {
      loadProperties();
      loadTenants();
      loadInquiries();
      loadBillingPlans();
    }
  }, [view, activeTab, token]);

  useEffect(() => {
    if (token && tenants.length > 0) {
      if (activeTab === 'maintenance') {
        loadMaintenanceComplaints();
      }
      if (activeTab === 'security') {
        loadSecurityInformation();
      }
    }
    if (activeTab === 'admin' && token) {
      loadAdminDetails();
    }
  }, [activeTab, tenants, token]);

  const handleLogout = () => {
    dispatch(logout());
  };

  if (view === 'login') {
    return (
      <Login
        setView={(val) => dispatch(setView(val))}
        setError={(val) => dispatch(setErrorMsg(val))}
        setSuccess={(val) => dispatch(setSuccessMsg(val))}
      />
    );
  }

  if (view === 'register') {
    return (
      <Register
        setView={(val) => dispatch(setView(val))}
        setError={(val) => dispatch(setErrorMsg(val))}
        setSuccess={(val) => dispatch(setSuccessMsg(val))}
      />
    );
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span style={{ fontSize: '28px' }}>🏨</span>
          <span>StayEaze</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: '4px' }}>
          Role: <strong>{roles[0]?.replace('ROLE_', '')}</strong>
        </div>
        <ul className="sidebar-menu">
          {menuItems.map(item => (
            <li
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => dispatch(setActiveTab(item.id))}
            >
              {item.label}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <button onClick={handleLogout} className="btn btn-primary btn-block" style={{ background: '#ef4444' }}>Log Out</button>
        </div>
      </aside>

      <main className="main-content">
        {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        {activeTab === 'home' && (
          <HomeDashboard
            propertiesCount={properties.length}
            tenantsCount={tenants.length}
            pendingComplaintsCount={allComplaints.filter(c => c.status !== 'RESOLVED').length}
          />
        )}

        {activeTab === 'properties' && (
          <PropertyPanel
            token={token}
            properties={properties}
            fetchProperties={loadProperties}
            fetchBuildings={api.getBuildings}
            setError={(val) => dispatch(setErrorMsg(val))}
            setSuccess={(val) => dispatch(setSuccessMsg(val))}
          />
        )}

        {activeTab === 'rooms' && (
          <RoomPanel
            token={token}
            properties={properties}
            setError={(val) => dispatch(setErrorMsg(val))}
            setSuccess={(val) => dispatch(setSuccessMsg(val))}
          />
        )}

        {activeTab === 'tenants' && (
          <TenantPanel
            token={token}
            tenants={tenants}
            fetchTenants={loadTenants}
            inquiries={inquiries}
            fetchInquiries={loadInquiries}
            setError={(val) => dispatch(setErrorMsg(val))}
            setSuccess={(val) => dispatch(setSuccessMsg(val))}
          />
        )}

        {activeTab === 'invoices' && (
          <BillingPanel
            token={token}
            tenants={tenants}
            billingPlans={billingPlans}
            fetchBillingPlans={loadBillingPlans}
            setError={(val) => dispatch(setErrorMsg(val))}
            setSuccess={(val) => dispatch(setSuccessMsg(val))}
          />
        )}

        {activeTab === 'maintenance' && (
          <MaintenancePanel
            token={token}
            tenants={tenants}
            allComplaints={allComplaints}
            fetchMaintenanceComplaints={loadMaintenanceComplaints}
            setError={(val) => dispatch(setErrorMsg(val))}
            setSuccess={(val) => dispatch(setSuccessMsg(val))}
          />
        )}

        {activeTab === 'security' && (
          <SecurityPanel
            token={token}
            tenants={tenants}
            allVisitors={allVisitors}
            allParcels={allParcels}
            allIncidents={allIncidents}
            fetchSecurityInformation={loadSecurityInformation}
            setError={(val) => dispatch(setErrorMsg(val))}
            setSuccess={(val) => dispatch(setSuccessMsg(val))}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel
            token={token}
            smsProvider={sysSmsProvider}
            emailProvider={sysEmailProvider}
            allowSelfRegistration={sysAllowSelfReg}
            maintenanceMode={sysMaintMode}
            notificationLogs={notificationLogs}
            auditLogs={auditLogs}
            fetchAdminDetails={loadAdminDetails}
            setError={(val) => dispatch(setErrorMsg(val))}
            setSuccess={(val) => dispatch(setSuccessMsg(val))}
          />
        )}
      </main>
    </div>
  );
}

export default App;
