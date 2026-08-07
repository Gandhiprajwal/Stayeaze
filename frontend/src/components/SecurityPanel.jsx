import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  addVisitorThunk,
  updateVisitorStatusThunk,
  addParcelThunk,
  handoverParcelThunk,
  addIncidentThunk,
  updateIncidentStatusThunk
} from '../store/slices/securitySlice';

export default function SecurityPanel({ token, tenants, allVisitors, allParcels, allIncidents, fetchSecurityInformation, setError, setSuccess }) {
  const dispatch = useDispatch();

  const [securitySubSection, setSecuritySubSection] = useState('visitors'); // 'visitors', 'parcels', 'incidents'

  // Forms
  const [visTenantId, setVisTenantId] = useState('');
  const [visName, setVisName] = useState('');
  const [visMobile, setVisMobile] = useState('');
  const [visPurpose, setVisPurpose] = useState('');

  const [parTenantId, setParTenantId] = useState('');
  const [parCompany, setParCompany] = useState('');
  const [parTrackNum, setParTrackNum] = useState('');
  const [parSignature, setParSignature] = useState('');

  const [incReportedBy, setIncReportedBy] = useState('');
  const [incDesc, setIncDesc] = useState('');
  const [incSeverity, setIncSeverity] = useState('LOW');

  const handleSaveVisitor = async (e) => {
    e.preventDefault();
    if (!visTenantId) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addVisitorThunk({
        token,
        tenants,
        tenantId: visTenantId,
        visitorName: visName,
        mobileNumber: visMobile,
        purpose: visPurpose
      })).unwrap();
      setSuccess('Visitor pre-registered successfully!');
      setVisName(''); setVisMobile(''); setVisPurpose('');
    } catch (err) {
      setError(err || 'Failed to register visitor.');
    }
  };

  const handleUpdateVisitorStatus = async (tenantId, visId, status) => {
    setError(''); setSuccess('');
    try {
      await dispatch(updateVisitorStatusThunk({
        token,
        tenants,
        tenantId,
        id: visId,
        checkpoint: status
      })).unwrap();
      setSuccess(`Visitor checked ${status === 'checkin' ? 'IN' : 'OUT'}!`);
    } catch (err) {
      setError(err || 'Failed to update visitor status.');
    }
  };

  const handleSaveParcel = async (e) => {
    e.preventDefault();
    if (!parTenantId) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addParcelThunk({
        token,
        tenants,
        tenantId: parTenantId,
        courierCompany: parCompany,
        trackingNumber: parTrackNum
      })).unwrap();
      setSuccess('Incoming parcel recorded successfully!');
      setParCompany(''); setParTrackNum('');
    } catch (err) {
      setError(err || 'Failed to log incoming parcel.');
    }
  };

  const handleHandoverParcel = async (e, tenantId, parId) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await dispatch(handoverParcelThunk({
        token,
        tenants,
        tenantId,
        id: parId,
        signature: parSignature
      })).unwrap();
      setSuccess('Parcel handed over successfully.');
      setParSignature('');
    } catch (err) {
      setError(err || 'Failed to handover parcel.');
    }
  };

  const handleSaveIncident = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await dispatch(addIncidentThunk({
        token,
        tenants,
        reportedBy: incReportedBy,
        description: incDesc,
        severity: incSeverity
      })).unwrap();
      setSuccess('Safety evacuation incident logged successfully!');
      setIncReportedBy(''); setIncDesc('');
    } catch (err) {
      setError(err || 'Failed to file incident report.');
    }
  };

  const handleUpdateIncidentStatus = async (id, status) => {
    setError(''); setSuccess('');
    try {
      await dispatch(updateIncidentStatusThunk({
        token,
        tenants,
        id,
        status
      })).unwrap();
      setSuccess(`Incident status updated to ${status}!`);
    } catch (err) {
      setError(err || 'Failed to update incident.');
    }
  };

  return (
    <>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', textAlign: 'left' }}>🚧 Security & Visitors Logs</h1>
      </header>

      <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '6px', marginBottom: '25px', textAlign: 'left' }}>
        <button className="btn" style={{ flex: 1, background: securitySubSection === 'visitors' ? 'var(--primary)' : 'transparent' }} onClick={() => setSecuritySubSection('visitors')}>👥 Visitor Logs</button>
        <button className="btn" style={{ flex: 1, background: securitySubSection === 'parcels' ? 'var(--primary)' : 'transparent' }} onClick={() => setSecuritySubSection('parcels')}>📦 Courier Parcels</button>
        <button className="btn" style={{ flex: 1, background: securitySubSection === 'incidents' ? 'var(--primary)' : 'transparent' }} onClick={() => setSecuritySubSection('incidents')}>🚨 Safety Incidents</button>
      </div>

      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', textAlign: 'left' }}>
        {securitySubSection === 'visitors' && (
          <>
            <div style={{ flex: '1', minWidth: '320px' }} className="card">
              <h3>📝 Pre-Register Visitor</h3>
              <form onSubmit={handleSaveVisitor} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                <select className="form-control" required value={visTenantId} onChange={e => setVisTenantId(e.target.value)}>
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                </select>
                <input className="form-control" placeholder="Visitor Name" required value={visName} onChange={e => setVisName(e.target.value)} />
                <input className="form-control" placeholder="Mobile Number" required value={visMobile} onChange={e => setVisMobile(e.target.value)} />
                <input className="form-control" placeholder="Purpose (e.g. Local Guardian)" required value={visPurpose} onChange={e => setVisPurpose(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-block">Pre-Register Guest</button>
              </form>
            </div>
            <div style={{ flex: '2', minWidth: '400px' }} className="card">
              <h3>📜 Visitor Checkpoints Log</h3>
              {allVisitors.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No visitors registered yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {allVisitors.map(vis => (
                    <div key={vis.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{vis.visitorName}</strong> ({vis.mobileNumber})
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Visiting: {vis.tenantName} | Purpose: {vis.purpose} | Status: <strong>{vis.status}</strong></p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {vis.status === 'PRE_REGISTERED' && (
                          <button className="btn" style={{ background: 'var(--primary)', padding: '4px 10px', fontSize: '11px' }} onClick={() => handleUpdateVisitorStatus(vis.tenant.id, vis.id, 'checkin')}>Check-In</button>
                        )}
                        {vis.status === 'CHECKED_IN' && (
                          <button className="btn" style={{ background: '#ef4444', padding: '4px 10px', fontSize: '11px' }} onClick={() => handleUpdateVisitorStatus(vis.tenant.id, vis.id, 'checkout')}>Check-Out</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {securitySubSection === 'parcels' && (
          <>
            <div style={{ flex: '1', minWidth: '320px' }} className="card">
              <h3>📦 Log Incoming Parcel</h3>
              <form onSubmit={handleSaveParcel} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                <select className="form-control" required value={parTenantId} onChange={e => setParTenantId(e.target.value)}>
                  <option value="">-- Choose Recipient --</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                </select>
                <input className="form-control" placeholder="Courier Company" required value={parCompany} onChange={e => setParCompany(e.target.value)} />
                <input className="form-control" placeholder="Tracking Number" value={parTrackNum} onChange={e => setParTrackNum(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-block">Record Parcel Arrival</button>
              </form>
            </div>
            <div style={{ flex: '2', minWidth: '400px' }} className="card">
              <h3>📜 Courier Arrivals Log</h3>
              {allParcels.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No parcels recorded yet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {allParcels.map(par => (
                    <div key={par.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{par.courierCompany} - {par.trackingNumber || 'No track ID'}</strong>
                        <span style={{ fontSize: '11px', color: par.status === 'HANDED_OVER' ? '#34d399' : '#fca5a5' }}>{par.status}</span>
                      </div>
                      <p style={{ margin: '4px 0 8px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Recipient: {par.tenantName}</p>
                      {par.status === 'RECEIVED' ? (
                        <form onSubmit={(e) => handleHandoverParcel(e, par.tenant.id, par.id)} style={{ display: 'flex', gap: '6px' }}>
                          <input className="form-control" style={{ padding: '4px 8px', fontSize: '12px', flex: 1 }} placeholder="Recipient Handover signature details" required value={parSignature} onChange={e => setParSignature(e.target.value)} />
                          <button type="submit" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px' }}>Handover</button>
                        </form>
                      ) : (
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>Handover Sign: "{par.recipientSignature}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {securitySubSection === 'incidents' && (
          <>
            <div style={{ flex: '1', minWidth: '320px' }} className="card">
              <h3>🚨 File Incident report</h3>
              <form onSubmit={handleSaveIncident} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                <input className="form-control" placeholder="Reported By" required value={incReportedBy} onChange={e => setIncReportedBy(e.target.value)} />
                <select className="form-control" value={incSeverity} onChange={e => setIncSeverity(e.target.value)}>
                  <option value="LOW">Low Severity</option>
                  <option value="MEDIUM">Medium Severity</option>
                  <option value="HIGH">High Emergency Alert</option>
                </select>
                <textarea className="form-control" rows="4" placeholder="Describe the safety incident details..." required value={incDesc} onChange={e => setIncDesc(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-block">Log Safety Incident</button>
              </form>
            </div>
            <div style={{ flex: '2', minWidth: '400px' }} className="card">
              <h3>🚨 Safety incident log trail</h3>
              {allIncidents.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No incidents reported.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {allIncidents.map(inc => (
                    <div key={inc.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', borderLeft: inc.severity === 'HIGH' ? '4px solid #ef4444' : '4px solid #fbbf24' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{inc.severity} Incident</strong>
                        <span style={{ fontSize: '11px', color: inc.status === 'RESOLVED' ? '#34d399' : '#fca5a5' }}>{inc.status}</span>
                      </div>
                      <p style={{ margin: '6px 0', fontSize: '13px' }}>{inc.description}</p>
                      <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: 'var(--text-secondary)' }}>Reported by: {inc.reportedBy} at {inc.reportedAt}</p>
                      {inc.status !== 'RESOLVED' && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {inc.status === 'REPORTED' && (
                            <button className="btn" style={{ background: '#f59e0b', padding: '4px 10px', fontSize: '11px' }} onClick={() => handleUpdateIncidentStatus(inc.id, 'INVESTIGATING')}>Investigate</button>
                          )}
                          <button className="btn" style={{ background: 'var(--success)', padding: '4px 10px', fontSize: '11px' }} onClick={() => handleUpdateIncidentStatus(inc.id, 'RESOLVED')}>Resolve</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
