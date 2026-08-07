import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  saveSystemConfigThunk,
  sendNotificationThunk,
  retryNotificationThunk,
  fetchOrganizationsThunk,
  createOrganizationThunk
} from '../store/slices/adminSlice';

export default function AdminPanel({ token, smsProvider, emailProvider, allowSelfRegistration, maintenanceMode, notificationLogs, auditLogs, fetchAdminDetails, setError, setSuccess }) {
  const dispatch = useDispatch();

  const [adminSubSection, setAdminSubSection] = useState('settings'); // 'settings', 'notifications', 'audit', 'organizations'

  // Forms
  const [sysSmsProvider, setSysSmsProvider] = useState(smsProvider);
  const [sysEmailProvider, setSysEmailProvider] = useState(emailProvider);
  const [sysAllowSelfReg, setSysAllowSelfReg] = useState(allowSelfRegistration);
  const [sysMaintMode, setSysMaintMode] = useState(maintenanceMode);

  const [notifRecipient, setNotifRecipient] = useState('');
  const [notifType, setNotifType] = useState('EMAIL');
  const [notifMessage, setNotifMessage] = useState('');

  const [orgName, setOrgName] = useState('');
  const [orgSubdomain, setOrgSubdomain] = useState('');

  // Selector for super admin check and organizations list
  const { user } = useSelector(state => state.auth);
  const organizations = useSelector(state => state.admin.organizations || []);
  const isSuperAdmin = user?.roles?.includes('ROLE_SUPER_ADMIN');

  useEffect(() => {
    if (isSuperAdmin) {
      dispatch(fetchOrganizationsThunk(token));
    }
  }, [isSuperAdmin, token, dispatch]);

  const handleSaveSystemConfig = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await dispatch(saveSystemConfigThunk({
        token,
        smsProvider: sysSmsProvider,
        emailProvider: sysEmailProvider,
        allowSelfRegistration: sysAllowSelfReg,
        maintenanceMode: sysMaintMode
      })).unwrap();
      setSuccess('Global configurations saved successfully!');
    } catch (err) {
      setError(err || 'Failed to save config.');
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await dispatch(sendNotificationThunk({
        token,
        recipient: notifRecipient,
        type: notifType,
        messageContent: notifMessage
      })).unwrap();
      setSuccess('Notification alert dispatched successfully.');
      setNotifRecipient(''); setNotifMessage('');
    } catch (err) {
      setError(err || 'Failed to dispatch alert.');
    }
  };

  const handleRetryNotification = async (notifId) => {
    setError(''); setSuccess('');
    try {
      await dispatch(retryNotificationThunk({ token, notifId })).unwrap();
      setSuccess('Notification alert retry queue dispatched.');
    } catch (err) {
      setError(err || 'Failed to retry notification.');
    }
  };

  const handleSaveOrganization = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await dispatch(createOrganizationThunk({ token, name: orgName, subdomain: orgSubdomain })).unwrap();
      setSuccess('Organization setup completed! Brand Subdomain registered.');
      setOrgName(''); setOrgSubdomain('');
    } catch (err) {
      setError(err || 'Failed to provision organization.');
    }
  };

  return (
    <>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', textAlign: 'left' }}>⚙️ Global Admin Settings</h1>
      </header>

      <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '6px', marginBottom: '25px', textAlign: 'left' }}>
        {isSuperAdmin && (
          <button className="btn" style={{ flex: 1, background: adminSubSection === 'organizations' ? 'var(--primary)' : 'transparent' }} onClick={() => setAdminSubSection('organizations')}>🏢 Organizations Setup</button>
        )}
        <button className="btn" style={{ flex: 1, background: adminSubSection === 'settings' ? 'var(--primary)' : 'transparent' }} onClick={() => setAdminSubSection('settings')}>⚙️ System Settings</button>
        <button className="btn" style={{ flex: 1, background: adminSubSection === 'notifications' ? 'var(--primary)' : 'transparent' }} onClick={() => setAdminSubSection('notifications')}>📨 Notification Alerts</button>
        <button className="btn" style={{ flex: 1, background: adminSubSection === 'audit' ? 'var(--primary)' : 'transparent' }} onClick={() => setAdminSubSection('audit')}>🔍 Security Audit Trails</button>
      </div>

      <div style={{ textAlign: 'left' }}>
        {adminSubSection === 'organizations' && isSuperAdmin && (
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '320px' }} className="card">
              <h3>🏢 Register New Brand Subdomain</h3>
              <form onSubmit={handleSaveOrganization} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Brand / Org Name</label>
                  <input type="text" className="form-control" placeholder="E.g. StayEaze Luxury PG" required value={orgName} onChange={e => setOrgName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Subdomain (Alphanumeric only)</label>
                  <input type="text" className="form-control" placeholder="E.g. luxury-pg" required value={orgSubdomain} onChange={e => setOrgSubdomain(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary">Provision Subdomain</button>
              </form>
            </div>
            <div style={{ flex: 2, minWidth: '400px' }} className="card">
              <h3>📋 Active SaaS Tenant Brands</h3>
              {organizations.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No active organization subdomains.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {organizations.map(org => (
                    <div key={org.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{org.name}</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Subdomain: <code>{org.subdomain}.stayeaze.com</code></p>
                      </div>
                      <span className="badge badge-success">{org.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {adminSubSection === 'settings' && (
          <div style={{ maxWidth: '600px' }} className="card">
            <h3>⚙️ Global configurations</h3>
            <form onSubmit={handleSaveSystemConfig} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
              <div className="form-group">
                <label className="form-label">SMS Gateway Provider</label>
                <input type="text" className="form-control" required value={sysSmsProvider} onChange={e => setSysSmsProvider(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email SMTP Provider</label>
                <input type="text" className="form-control" required value={sysEmailProvider} onChange={e => setSysEmailProvider(e.target.value)} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" checked={sysAllowSelfReg} onChange={e => setSysAllowSelfReg(e.target.checked)} />
                Allow Tenant Self-Registration Checkmark options
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" checked={sysMaintMode} onChange={e => setSysMaintMode(e.target.checked)} />
                Activate Application Maintenance Mode
              </label>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>Save System configurations</button>
            </form>
          </div>
        )}

        {adminSubSection === 'notifications' && (
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '320px' }} className="card">
              <h3>📨 Send template alert</h3>
              <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                <input className="form-control" placeholder="Recipient (email/mobile)" required value={notifRecipient} onChange={e => setNotifRecipient(e.target.value)} />
                <select className="form-control" value={notifType} onChange={e => setNotifType(e.target.value)}>
                  <option value="EMAIL">Email Template</option>
                  <option value="SMS">SMS Gateway Template</option>
                  <option value="WHATSAPP">WhatsApp Alert Template</option>
                </select>
                <textarea className="form-control" rows="4" placeholder="Alert message text..." required value={notifMessage} onChange={e => setNotifMessage(e.target.value)} />
                <button type="submit" className="btn btn-primary">Dispatch notification</button>
              </form>
            </div>
            <div style={{ flex: 2, minWidth: '400px' }} className="card">
              <h3>📜 Dispatched Alerts History</h3>
              {notificationLogs.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No notifications dispatched.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notificationLogs.map(log => (
                    <div key={log.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>To: {log.recipient} ({log.type})</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>"{log.messageContent}"</p>
                        <span style={{ fontSize: '11px', color: log.status === 'SENT' ? '#34d399' : '#fca5a5' }}>Status: {log.status}</span>
                      </div>
                      {log.status === 'FAILED' && (
                        <button className="btn" style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--primary)' }} onClick={() => handleRetryNotification(log.id)}>Retry</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {adminSubSection === 'audit' && (
          <div className="card">
            <h3>🔍 Security Auditing Logs</h3>
            {auditLogs.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No audit actions recorded.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                {auditLogs.map(log => (
                  <div key={log.id} style={{ padding: '10px', background: 'var(--bg-input)', borderRadius: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>{log.username}</strong>: {log.action}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>IP: {log.clientIp} | {log.timestamp.substring(0,19)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
