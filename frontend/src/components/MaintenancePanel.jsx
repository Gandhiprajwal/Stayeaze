import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { addComplaintThunk, updateComplaintStatusThunk, submitFeedbackThunk } from '../store/slices/maintenanceSlice';
import { fetchBookingsThunk } from '../store/slices/tenantSlice';

export default function MaintenancePanel({ token, tenants, allComplaints, fetchMaintenanceComplaints, setError, setSuccess }) {
  const dispatch = useDispatch();

  const [compTenantId, setCompTenantId] = useState('');
  const [compCategory, setCompCategory] = useState('PLUMBING');
  const [compDesc, setCompDesc] = useState('');
  const [compAssignee, setCompAssignee] = useState('');
  const [compRating, setCompRating] = useState('5');
  const [compFeedbackNotes, setCompFeedbackNotes] = useState('');

  const handleSaveComplaint = async (e) => {
    e.preventDefault();
    if (!compTenantId) return;
    setError(''); setSuccess('');
    try {
      const bookingsRes = await dispatch(fetchBookingsThunk({ token, tenantId: compTenantId })).unwrap();
      const roomId = (bookingsRes.length > 0 && bookingsRes[0].bed?.room) ? bookingsRes[0].bed.room.id : null;
      
      await dispatch(addComplaintThunk({
        token,
        tenants,
        tenantId: compTenantId,
        category: compCategory,
        description: compDesc,
        roomId
      })).unwrap();
      
      setSuccess('Complaint support ticket submitted!');
      setCompDesc('');
    } catch (err) {
      setError(err || 'Failed to file support complaint.');
    }
  };

  const handleUpdateComplaintStatus = async (tenantId, compId, status, staff) => {
    setError(''); setSuccess('');
    try {
      await dispatch(updateComplaintStatusThunk({
        token,
        tenants,
        tenantId,
        compId,
        status,
        staff
      })).unwrap();
      setSuccess(`Complaint status updated to ${status}!`);
    } catch (err) {
      setError(err || 'Failed to update ticket status.');
    }
  };

  const handleSaveFeedback = async (e, tenantId, compId) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await dispatch(submitFeedbackThunk({
        token,
        tenants,
        tenantId,
        compId,
        feedbackRating: parseInt(compRating),
        feedbackNotes: compFeedbackNotes
      })).unwrap();
      setSuccess('Tenant satisfaction feedback logged!');
      setCompFeedbackNotes('');
    } catch (err) {
      setError(err || 'Failed to save feedback rating.');
    }
  };

  return (
    <>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', textAlign: 'left' }}>🛠️ Maintenance & Room Support</h1>
      </header>

      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', textAlign: 'left' }}>
        <div style={{ flex: '1', minWidth: '320px' }} className="card">
          <h3>Lodge Support Ticket / Task</h3>
          <form onSubmit={handleSaveComplaint} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <div className="form-group">
              <label className="form-label">Resident / Tenant</label>
              <select className="form-control" required value={compTenantId} onChange={e => setCompTenantId(e.target.value)}>
                <option value="">-- Choose Resident --</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} {t.roomNumber ? `• Room ${t.roomNumber}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" value={compCategory} onChange={e => setCompCategory(e.target.value)}>
                <option value="PLUMBING">Plumbing Issues</option>
                <option value="ELECTRICAL">Electrical Breakdown</option>
                <option value="WIFI">Wi-Fi &amp; Internet</option>
                <option value="HOUSEKEEPING">Housekeeping &amp; Cleaning</option>
                <option value="OTHER">Miscellaneous Maintenance</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description details</label>
              <textarea className="form-control" rows="4" required placeholder="Describe the maintenance queries..." value={compDesc} onChange={e => setCompDesc(e.target.value)} />
            </div>

            <button type="submit" className="btn btn-primary btn-block">Submit support ticket</button>
          </form>
        </div>

        <div style={{ flex: '2', minWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px' }} className="card">
          <h3>Support queries pipeline</h3>
          {allComplaints.length === 0 ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No active maintenance queries.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {allComplaints.map(comp => (
                <div key={comp.id} style={{ padding: '15px', background: 'var(--bg-input)', borderRadius: '8px', borderLeft: comp.status === 'RESOLVED' ? '4px solid var(--success)' : comp.status === 'IN_PROGRESS' ? '4px solid #f59e0b' : '4px solid #ef4444' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>{comp.category} Issue</strong>
                    <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: comp.status === 'RESOLVED' ? 'rgba(16,185,129,0.2)' : comp.status === 'IN_PROGRESS' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)', color: comp.status === 'RESOLVED' ? '#34d399' : comp.status === 'IN_PROGRESS' ? '#fbbf24' : '#fca5a5' }}>
                      {comp.status}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>{comp.description}</p>
                  <div style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>Logged by: <strong>{comp.tenantName}</strong></span>
                    {comp.room && (
                      <span>
                        | <strong>Room {comp.room.roomNumber}</strong> {comp.room.propertyName ? `(${comp.room.propertyName} › ${comp.room.buildingName || ''})` : ''}
                      </span>
                    )}
                  </div>

                  {comp.assignedStaff && (
                    <p style={{ margin: '0 0 12px 0', fontSize: '12px' }}>Assigned Staff: <strong>{comp.assignedStaff}</strong></p>
                  )}

                  {comp.status === 'OPEN' && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <input type="text" className="form-control" style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }} placeholder="Enter Staff Name" value={compAssignee} onChange={e => setCompAssignee(e.target.value)} />
                      <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => handleUpdateComplaintStatus(comp.tenant.id, comp.id, 'IN_PROGRESS', compAssignee)}>
                        Assign Staff
                      </button>
                    </div>
                  )}

                  {comp.status === 'IN_PROGRESS' && (
                    <button className="btn" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', fontSize: '12px', padding: '6px 12px', marginTop: '10px' }} onClick={() => handleUpdateComplaintStatus(comp.tenant.id, comp.id, 'RESOLVED', null)}>
                      Mark as Resolved
                    </button>
                  )}

                  {comp.status === 'RESOLVED' && comp.feedbackRating === null && (
                    <form onSubmit={(e) => handleSaveFeedback(e, comp.tenant.id, comp.id)} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px' }}>
                      <label className="form-label" style={{ fontSize: '12px' }}>Tenant Feedback Rating</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <select className="form-control" style={{ width: '80px', padding: '4px', fontSize: '12px' }} value={compRating} onChange={e => setCompRating(e.target.value)}>
                          <option value="5">⭐⭐⭐⭐⭐</option>
                          <option value="4">⭐⭐⭐⭐</option>
                          <option value="3">⭐⭐⭐</option>
                          <option value="2">⭐⭐</option>
                          <option value="1">⭐</option>
                        </select>
                        <input type="text" className="form-control" style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }} placeholder="Add satisfaction reviews..." value={compFeedbackNotes} onChange={e => setCompFeedbackNotes(e.target.value)} />
                        <button type="submit" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }}>Submit</button>
                      </div>
                    </form>
                  )}

                  {comp.status === 'RESOLVED' && comp.feedbackRating !== null && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '10px', fontSize: '12px', color: '#fbbf24' }}>
                      <span>Rating: {'★'.repeat(comp.feedbackRating)}{'☆'.repeat(5 - comp.feedbackRating)}</span>
                      {comp.feedbackNotes && <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>Comment: "{comp.feedbackNotes}"</p>}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
